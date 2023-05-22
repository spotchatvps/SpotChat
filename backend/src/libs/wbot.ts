import makeWASocket, {
  AnyWASocket,
  AuthenticationState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay,
  MessageRetryMap,
  proto,
  WAMessageUpdate
} from "@ercsaczap/wa-connector";

import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import Message from "../models/Message";
import { useMultiFileAuthState } from "../helpers/useMultiFileAuthState";
import { cacheLayer } from "./cache";

import ProxyAgent from "proxy-agent";
import Proxy from "../models/Proxy";
import sequelize from "../database";
import { Op } from "sequelize";
import moment from "moment";
import createOrUpdateBaileysService from "../services/BaileysServices/CreateOrUpdateBaileysService";
import { wbotQueue } from "../queues/wbot";
import { filterMessages } from "../services/WbotServices/wbotMessageListener";
import { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";
import path from "path";

type Session = AnyWASocket & {
  id?: number;
};

export const sessions: Session[] = [];

const msgRetryCounterMap: MessageRetryMap = {};

const retriesQrCodeMap = new Map<number, number>();

const getMessage = async key => {
  const message = await Message.findOne({
    where: { id: key.id }
  });

  await delay(1000);
  if (!message) return;

  //default
  let options = {
    conversation: message.body
  };

  if (message.mediaUrl !== null) {
    const fileName = message.getDataValue("mediaUrl");
    const filePath = path.resolve("public", fileName);
    options = await getMessageOptions(fileName, filePath);
  }

  return options;
};

export const sessionExists = (whatsappId: number) => {
  return sessions.findIndex(s => s.id === +whatsappId) > -1;
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === +whatsappId);

  if (!sessionExists(whatsappId)) {
    const io = getIO();
    Whatsapp.findByPk(whatsappId).then(async (whatsapp: Whatsapp) => {
      io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
        action: "update",
        session: whatsapp
      });
      await removeWbot(whatsapp.id, false);
      setTimeout(async () => {
        await initWASocket(whatsapp);
      }, 3000);
    });
    logger.error("ERR_WAPP_NOT_INITIALIZED");
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

export const removeWbot = async (whatsappId: number, isLogout = true) => {
  new Promise(async (resolve, reject) => {
    try {
      const sessionIndex = sessions.findIndex(s => s.id === +whatsappId);
      if (sessionIndex !== -1) {
        if (isLogout) {
          await sessions[sessionIndex]?.logout();
        }
        sessions[sessionIndex]?.ws?.close();
        sessions.splice(sessionIndex, 1);
      }
      resolve(sessions);
    } catch (err) {
      logger.error(err);
      reject(err);
    }
  });
};

export const addSession = session => {
  if (!sessionExists(session.id)) {
    sessions.push(session);
  }
};

async function setupSocket(whatsapp: Whatsapp) {
  const { id, name } = whatsapp;

  const { version, isLatest } = await fetchLatestBaileysVersion();

  logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  logger.info(`Starting session ${name} (${id})`);

  let options = {};

  let where = {};

  if (whatsapp.proxy_uri !== null) {
    where = {
      uri: {
        [Op.ne]: whatsapp.proxy_uri
      }
    };
  }

  const proxy = await Proxy.findOne({ order: sequelize.random(), where });

  if (proxy) {
    options = {
      agent: new ProxyAgent(proxy.uri),
      fetchAgent: new ProxyAgent(proxy.uri)
    };
  }

  let socket: Session = null;

  const { state, saveCreds } = await useMultiFileAuthState(whatsapp);

  socket = makeWASocket({
    ...options,
    browser: ["Sacmais", "Chrome", "10.15.7"],
    logger,
    printQRInTerminal: true,
    auth: state as AuthenticationState,
    version,
    msgRetryCounterMap,
    getMessage
  });

  socket.ev.on("contacts.upsert", contacts =>
    handleContactsUpsert({ contacts, whatsappId: id })
  );

  socket.ev.on("messages.update", event => handleMessagesUpdate({ event }));

  socket.ev.on("messages.upsert", event =>
    handleMessagesUpsert({ event, whatsappId: id })
  );

  socket.ev.on("creds.update", saveCreds);

  return { socket, state, saveCreds, proxy };
}

async function handleContactsUpsert({ contacts, whatsappId }) {
  createOrUpdateBaileysService({
    whatsappId,
    contacts
  });
}

async function handleMessagesUpsert({ event, whatsappId }) {
  const messages = event.messages.filter(filterMessages).map(msg => msg);

  if (!messages) return;

  messages.forEach(async (message: proto.IWebMessageInfo) => {
    wbotQueue.add(
      "MessagesUpsert",
      {
        message: { ...message },
        whatsappId
      },
      {
        priority: 1
      }
    );
  });
}

async function handleMessagesUpdate({ event }) {
  if (event.length === 0) return;
  event.forEach(async (message: WAMessageUpdate) => {
    // await handleMsgAck(message, message.update.status);
    wbotQueue.add(
      "MessagesUpdate",
      {
        message: { ...message }
      },
      {
        priority: 1
      }
    );
  });
}

async function handleConnectionClose({
  whatsapp,
  proxy,
  io,
  disconnectStatus
}) {
  if (disconnectStatus === DisconnectReason.loggedOut) {
    if (proxy) {
      await proxy.update({
        connections: proxy.connections > 0 ? proxy.connections - 1 : 0
      });
    }

    logger.info(
      `Socket ${whatsapp.name} Connection Update: Close -> ${whatsapp.name} (${whatsapp.id})`
    );

    await whatsapp.update({
      status: "DISCONNECT",
      session: ""
    });

    await DeleteBaileysService(whatsapp.id);
    await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);

    io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });
  }

  await removeWbot(whatsapp.id, false);

  const verifySession = sessionExists(whatsapp.id) ? "sim" : "não";
  logger.info(
    `wbot -> handleConnectionClose -> ${whatsapp.name} (${whatsapp.id}): sessão existe? ${verifySession}`
  );

  setTimeout(async () => {
    await initWASocket(whatsapp);
  }, 3000);
}

async function handleConnectionOpen({ whatsapp, proxy, socket, io }) {
  if (proxy) {
    await proxy.update({ connections: proxy.connections + 1 });
    await whatsapp.update({
      proxy_uri: proxy.uri,
      proxy_set_at: moment(),
      count_messages: 0
    });
  } else {
    await whatsapp.update({
      proxy_uri: null,
      proxy_set_at: null,
      count_messages: 0
    });
  }

  await whatsapp.update({
    status: "CONNECTED",
    qrcode: "",
    retries: 0
  });

  socket.id = whatsapp.id;
  addSession(socket);

  io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
    action: "update",
    session: whatsapp
  });
}

async function handleQrCode({
  whatsapp,
  update,
  socket,
  qr,
  id,
  io,
  retriesQrCode
}) {
  if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
    await update.update({
      status: "DISCONNECTED",
      qrcode: ""
    });
    await DeleteBaileysService(update.id);
    await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
    io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
      action: "update",
      session: update
    });
    socket.ev.removeAllListeners("connection.update");
    socket.ws.close();
    socket = null;
    retriesQrCodeMap.delete(id);
  } else {
    logger.info(`Session QRCode Generate ${whatsapp.name}`);
    retriesQrCodeMap.set(id, (retriesQrCode += 1));

    await whatsapp.update({
      qrcode: qr,
      status: "qrcode",
      retries: 0
    });

    socket.id = whatsapp.id;
    addSession(socket);

    io.emit(`company-${whatsapp.companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });
  }
}

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (whatsapp == null || whatsapp.id == undefined) {
        logger.info("initWaSocket -> Conexão não encontrada");
        resolve(null);
        return;
      }

      const whatsappFound = await Whatsapp.findOne({
        where: { id: whatsapp.id }
      });

      if (!whatsappFound) {
        removeWbot(whatsapp.id, true);
        logger.info("initWaSocket -> Conexão não encontrada");
        resolve(null);
        return;
      }

      if (sessionExists(whatsapp.id)) {
        const currentSession = getWbot(whatsapp.id);
        resolve(currentSession);
        return;
      }

      const io = getIO();

      const { socket, proxy } = await setupSocket(whatsappFound);

      socket.ev.on("connection.update", async update => {
        try {
          const { id } = whatsapp;
          let retriesQrCode = 0;

          const { connection, lastDisconnect, qr } = update;
          if (connection === "close") {
            const disconnectStatus = (lastDisconnect?.error as Boom)?.output
              ?.statusCode;
            logger.info(
              `connection.update -> close: ${whatsapp.name} (${whatsapp.id}), ${disconnectStatus}`
            );
            await handleConnectionClose({
              whatsapp,
              proxy,
              io,
              disconnectStatus
            });
          }

          if (connection === "open") {
            logger.info(
              `connection.update -> open: ${whatsapp.name} (${whatsapp.id})`
            );
            await handleConnectionOpen({ whatsapp, proxy, socket, io });
            resolve(socket);
          }

          if (qr !== undefined) {
            handleQrCode({
              whatsapp,
              update,
              socket,
              qr,
              id,
              io,
              retriesQrCode
            });
          }

          if (connection === "connecting") {
            logger.info(
              `connection.update -> connecting...: ${whatsapp.name} (${whatsapp.id})`
            );
          }
        } catch (error) {
          logger.error(`wbot -> error: ${error.message}`);
          logger.error(`wbot -> stack: ${error.stack}`);
        }
      });
    } catch (error) {
      logger.error(`wbot -> error: ${error.message}`);
      logger.error(`wbot -> stack: ${error.stack}`);
      reject(error);
    }
  });
};
