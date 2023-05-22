import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { isNull } from "lodash";

import {
  AnyWASocket,
  downloadContentFromMessage,
  extractMessageContent,
  getContentType,
  jidNormalizedUser,
  MediaType,
  proto,
  WALegacySocket,
  WAMessage,
  WAMessageStubType,
  WASocket
} from "@ercsaczap/wa-connector";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import formatBody from "../../helpers/Mustache";
import { Store } from "../../libs/store";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import Queue from "../../models/Queue";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import { Op } from "sequelize";
import User from "../../models/User";
import { contactQueue } from "../../queues/contacts";
import { TranslateVariables } from "../TicketServices/TranslateVariables";

import { cacheLayer } from "../../libs/cache";
import Whatsapp from "../../models/Whatsapp";
import { removeWbot } from "../../libs/wbot";
import {
  HandleChatbot,
  handleOutOfHoursFromCompany,
  handleOutOfHoursFromQueue,
  verifyOutOfHoursFromCompany,
  verifyOutOfHoursFromQueue,
  verifyOutOfHoursSetup
} from "./HandleChatbot";
import { VerifyQueue } from "./VerifyQueue";

type Session = AnyWASocket & {
  id?: number;
  store?: Store;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: any;
}

interface IMe {
  name: string;
  id: string;
}

const writeFileAsync = promisify(writeFile);

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  return getContentType(msg.message);
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  return (
    msg.message?.conversation ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.templateButtonReplyMessage?.selectedId ||
    msg.message?.viewOnceMessage?.message?.buttonsMessage?.contentText ||
    msg.message?.viewOnceMessage?.message?.listMessage?.description ||
    msg.message?.buttonsResponseMessage?.selectedDisplayText ||
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.listResponseMessage?.title ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage?.caption
  );
};

export const getQuotedMessage = (msg: proto.IWebMessageInfo): any => {
  const body =
    msg.message.imageMessage.contextInfo ||
    msg.message.videoMessage.contextInfo ||
    msg.message.extendedTextMessage.contextInfo ||
    msg.message.buttonsResponseMessage.contextInfo ||
    msg.message.listResponseMessage.contextInfo ||
    msg.message.templateButtonReplyMessage.contextInfo ||
    msg.message.buttonsResponseMessage?.contextInfo ||
    msg.message.listResponseMessage?.contextInfo;
  // testar isso

  return extractMessageContent(body[Object.keys(body).values().next().value]);
};

export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];

  return body?.contextInfo?.stanzaId;
};

const getMeSocket = (wbot: Session): IMe => {
  return wbot.type === "legacy"
    ? {
        id: jidNormalizedUser((wbot as WALegacySocket).state.legacy.user.id),
        name: (wbot as WALegacySocket).state.legacy.user.name
      }
    : {
        id: jidNormalizedUser((wbot as WASocket).user.id),
        name: (wbot as WASocket).user.name
      };
};

const getSenderMessage = (
  msg: proto.IWebMessageInfo,
  wbot: Session
): string => {
  const me = getMeSocket(wbot);
  if (msg.key.fromMe) return me.id;

  const senderId =
    msg.participant || msg.key.participant || msg.key.remoteJid || undefined;

  return senderId && jidNormalizedUser(senderId);
};

const getContactMessage = async (msg: proto.IWebMessageInfo, wbot: Session) => {
  // if (wbot.type === "legacy") {
  //   return wbot.store.contacts[msg.key.participant || msg.key.remoteJid] as IMe;
  // }

  const isGroup = msg.key.remoteJid.includes("g.us");
  const rawNumber = msg.key.remoteJid.replace(/\D/g, "");
  return isGroup
    ? {
        id: getSenderMessage(msg, wbot),
        name: msg.pushName
      }
    : {
        id: msg.key.remoteJid,
        name: msg.key.fromMe ? rawNumber : msg.pushName
      };
};

const downloadMedia = async (msg: proto.IWebMessageInfo) => {
  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

  let messageType = mineType.mimetype
    .split("/")[0]
    .replace("application", "document")
    ? (mineType.mimetype
        .split("/")[0]
        .replace("application", "document") as MediaType)
    : (mineType.mimetype.split("/")[0] as MediaType);

  let stream;
  let contDownload = 0;

  if (msg.message.documentMessage || msg.message.documentWithCaptionMessage) {
    messageType = "document";
  }

  while (contDownload < 10 && !stream) {
    try {
      contDownload > 1
        ? logger.warn(`Tentativa ${contDownload} de baixar o arquivo`)
        : "";

      stream = await downloadContentFromMessage(
        msg.message.audioMessage ||
          msg.message.videoMessage ||
          msg.message.documentMessage ||
          msg.message.documentWithCaptionMessage?.message?.documentMessage ||
          msg.message.imageMessage ||
          msg.message.stickerMessage ||
          msg.message.extendedTextMessage?.contextInfo.quotedMessage
            .imageMessage ||
          msg.message?.buttonsMessage?.imageMessage ||
          msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
          msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
          msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
          msg.message?.interactiveMessage?.header?.imageMessage,
        messageType
      );
    } catch (error) {
      contDownload++;
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * contDownload * 2)
      );
      logger.warn(`>>>> erro ${contDownload} de baixar o arquivo`);
    }
  }

  let buffer = Buffer.from([]);
  // eslint-disable-next-line no-restricted-syntax
  try {
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
  } catch (error) {
    return { data: "error", mimetype: "", filename: "" };
  }

  if (!buffer) {
    Sentry.setExtra("ERR_WAPP_DOWNLOAD_MEDIA", { msg });
    Sentry.captureException(new Error("ERR_WAPP_DOWNLOAD_MEDIA"));
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }
  let filename = msg.message?.documentMessage?.fileName || "";

  if (!filename) {
    const ext = mineType.mimetype.split("/")[1].split(";")[0];
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }
  const media = {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };
  return media;
};

const verifyContact = async (
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> => {
  const contactData = {
    name: msgContact.name || msgContact.id.replace(/\D/g, ""),
    number: msgContact.id,
    isGroup: msgContact.id.includes("g.us"),
    companyId
  };

  const contact = await CreateOrUpdateContactService(contactData);

  contactQueue.add(
    "FindPicture",
    {
      msgContactId: msgContact.id,
      contactId: contact.id,
      whatsappId: wbot.id
    },
    {
      priority: 3,
      removeOnComplete: { age: 60 * 60, count: 10 },
      removeOnFail: { age: 60 * 60, count: 10 }
    }
  );

  return contact;
};

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { id: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);

  const media = await downloadMedia(msg);

  if (!media) {
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  if (!media.filename) {
    const ext = media.mimetype.split("/")[1].split(";")[0];
    media.filename = `${new Date().getTime()}.${ext}`;
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "..", "public", media.filename),
      media.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  const body = getBodyMessage(msg);
  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: body ? body : media.filename,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    mediaUrl: media.filename,
    mediaType: media.mimetype.split("/")[0],
    quotedMsgId: quotedMsg?.id,
    ack: msg.status,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg)
  };

  await ticket.update({
    lastMessage: body || media.filename
  });

  const newMessage = await CreateMessageService({
    messageData,
    companyId: ticket.companyId
  });

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    io.to("closed").emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

    io.to(ticket.status)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }

  return newMessage;
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket
) => {
  try {
    const io = getIO();
    const quotedMsg = await verifyQuotedMessage(msg);
    const body = getBodyMessage(msg);

    const messageData = {
      id: msg.key.id,
      ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : ticket.contact.id,
      body,
      fromMe: msg.key.fromMe,
      mediaType: getTypeMessage(msg),
      read: msg.key.fromMe,
      quotedMsgId: quotedMsg?.id,
      ack: msg.status,
      remoteJid: msg.key.remoteJid,
      participant: msg.key.participant,
      dataJson: JSON.stringify(msg)
    };

    await ticket.update({
      lastMessage: body
    });

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    if (!msg.key.fromMe && ticket.status === "closed") {
      await ticket.update({ status: "pending" });
      await ticket.reload({
        include: [
          { model: Queue, as: "queue" },
          { model: User, as: "user" },
          { model: Contact, as: "contact" }
        ]
      });

      io.to("closed").emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

      io.to(ticket.status)
        .to(ticket.id.toString())
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }
  } catch (e) {
    Sentry.captureException(e);
  }
};

const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;
  const msgType = getTypeMessage(msg);
  const ifType =
    msgType === "conversation" ||
    msgType === "extendedTextMessage" ||
    msgType === "audioMessage" ||
    msgType === "videoMessage" ||
    msgType === "imageMessage" ||
    msgType === "documentMessage" ||
    msgType === "documentWithCaptionMessage" ||
    msgType === "stickerMessage" ||
    msgType === "ephemeralMessage" ||
    msgType === "buttonsResponseMessage" ||
    msgType === "viewOnceMessage" ||
    msgType === "listResponseMessage";

  return !!ifType;
};

const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt !== null
  ) {
    return true;
  }
  return false;
};

const handleRating = async (
  msg: WAMessage,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();
  let rate: number | null = null;

  const bodyMessage = getBodyMessage(msg);

  if (bodyMessage) {
    const numbers = bodyMessage.match(/\d/g);
    rate = +numbers.join("");
  }

  if (!Number.isNaN(rate) && Number.isInteger(rate) && !isNull(rate)) {
    const { complationMessage } = await ShowWhatsAppService(
      ticket.whatsappId,
      ticket.companyId
    );

    let finalRate = rate;

    if (rate < 1) {
      finalRate = 1;
    }
    if (rate > 3) {
      finalRate = 3;
    }

    await UserRating.create({
      ticketId: ticketTraking.ticketId,
      companyId: ticketTraking.companyId,
      userId: ticketTraking.userId,
      rate: finalRate
    });

    const body = TranslateVariables(`\u200e${complationMessage}`, {
      contact: ticket.contact,
      ticket
    });
    await SendWhatsAppMessage({ body, ticket });

    await ticketTraking.update({
      finishedAt: moment().toDate(),
      rated: true
    });

    await ticket.update({
      queueId: null,
      userId: null,
      status: "closed",
      flowStatus: "FINISHED"
    });

    io.to("open").emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

    io.to(ticket.status)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
    logger.info(`handleRating (538) -> Avaliação realizada: ${bodyMessage}`);
  } else {
    console.error(
      `handleRating (541) -> Erro na avaliação -> bodyMessage: ${bodyMessage}`
    );
  }
};

const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<void> => {
  if (!isValidMsg(msg)) {
    return;
  }

  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;
    const bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

    if (/\u200c/.test(bodyMessage)) {
      return;
    }

    const hasMedia =
      msg.message?.audioMessage ||
      msg.message?.imageMessage ||
      msg.message?.videoMessage ||
      msg.message?.documentMessage ||
      msg.message?.stickerMessage ||
      msg.message?.documentWithCaptionMessage;

    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;

      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "ephemeralMessage" &&
        msgType !== "buttonsResponseMessage" &&
        msgType !== "documentWithCaptionMessage" &&
        msgType !== "listResponseMessage" &&
        msgType !== "viewOnceMessage" &&
        msgType !== "vcard"
      )
        return;
      msgContact = await getContactMessage(msg, wbot);
    } else {
      msgContact = await getContactMessage(msg, wbot);
    }

    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    if (isGroup) {
      return;
    }

    if (isGroup) {
      const grupoMeta = await wbot.groupMetadata(msg.key.remoteJid, false);
      const msgGroupContact = {
        id: grupoMeta.id,
        name: grupoMeta.subject
      };
      groupContact = await verifyContact(msgGroupContact, wbot, companyId);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
    await whatsapp.update({ count_messages: whatsapp.count_messages + 1 });

    let unreadMessages = 0;

    const contact = await verifyContact(msgContact, wbot, companyId);

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    if (
      unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === bodyMessage
    ) {
      return;
    }

    const ticket = await FindOrCreateTicketService(
      contact,
      wbot.id!,
      unreadMessages,
      companyId,
      groupContact
    );

    await cacheLayer.delFromPattern(
      `company:${companyId}:tickets:${ticket.id}:*`
    );

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: whatsapp?.id
    });

    try {
      if (!msg.key.fromMe) {
        /**
         * Tratamento para avaliação do atendente
         */
        if (verifyRating(ticketTraking)) {
          handleRating(msg, ticket, ticketTraking);
          return;
        }
      }
    } catch (e) {
      console.error(`handleMessage (663) -> e.message: ${e.message}`);
      console.error(`handleMessage (664) -> e.stack: ${e.stack}`);
    }

    if (hasMedia) {
      await verifyMediaMessage(msg, ticket, contact);
    } else {
      await verifyMessage(msg, ticket);
    }

    const dontReadTheFirstQuestion = ticket.queue === null;

    if (
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      await VerifyQueue(wbot, msg, ticket, ticket.contact);
    }

    await ticket.reload();

    if (!ticket.chatbot && ticket.queueId !== null) {
      const settingType = await verifyOutOfHoursSetup(ticket);
      if (settingType === "queue") {
        const outOfHours = await verifyOutOfHoursFromQueue(msg, ticket);
        if (outOfHours) {
          await handleOutOfHoursFromQueue(ticket, wbot);
        }
      } else if (settingType === "company") {
        const outOfHours = await verifyOutOfHoursFromCompany(msg, ticket);
        if (outOfHours) {
          await handleOutOfHoursFromCompany(ticket, wbot);
        }
      }
    }

    if (
      //Fluxo de enviar apenas a mensagem de boas-vindas apenas uma vez
      isNull(ticket.queueId) &&
      ticket.status !== "open" &&
      !msg.key.fromMe &&
      whatsapp.queues.length <= 1
    ) {
      const greetingMessage = whatsapp.greetingMessage || "";
      if (greetingMessage !== "") {
        const messageExpected = TranslateVariables(greetingMessage, {
          contact,
          ticket
        });

        //verifica se existe uma mensagem de boas-vindas para este ticket
        const lastGreetingMessage = await Message.findOne({
          where: {
            ticketId: ticket.id,
            body: {
              [Op.like]: `%${messageExpected}%`
            }
          },
          order: [["createdAt", "DESC"]]
        });

        if (lastGreetingMessage == null) {
          await wbot.sendMessage(
            `${ticket.contact.number}@${
              ticket.isGroup ? "g.us" : "s.whatsapp.net"
            }`,
            {
              text: messageExpected
            }
          );
        }
        return;
      }
    }

    if (whatsapp.queues.length == 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await HandleChatbot(ticket, msg, wbot);
      }
    }
    if (whatsapp.queues.length > 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await HandleChatbot(ticket, msg, wbot, dontReadTheFirstQuestion);
      }
    }
  } catch (err) {
    logger.error(`Error handling whatsapp message: Err: ${err.message}`);
    logger.error(`Error handling whatsapp message: Err: ${err.stack}`);
  }
};

export const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));
  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(msg.key.id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (!messageToUpdate) return;

    const ack = chat > messageToUpdate.ack ? chat : messageToUpdate.ack;
    await messageToUpdate.update({ ack });

    io.to(messageToUpdate.ticketId.toString()).emit(
      `company-${messageToUpdate.companyId}-appMessage`,
      {
        action: "update",
        message: messageToUpdate
      }
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

export const filterMessages = (msg: WAMessage): boolean => {
  if (msg.message?.protocolMessage) return false;

  if (
    [
      WAMessageStubType.REVOKE,
      WAMessageStubType.E2E_DEVICE_CHANGED,
      WAMessageStubType.E2E_IDENTITY_CHANGED,
      WAMessageStubType.CIPHERTEXT
    ].includes(msg.messageStubType as WAMessageStubType)
  )
    return false;

  return true;
};

export const verifyAndReconnectWhatsapp = async (wbot: Session) => {
  const whatsapp = await Whatsapp.findByPk(wbot.id!);
  if (
    whatsapp &&
    whatsapp.proxy_uri !== null &&
    whatsapp.count_messages > 1500
  ) {
    logger.info(
      `Conexão ${whatsapp.name} será reiniciada pois já enviou 1500 mensagens`
    );
    await whatsapp.update({ count_messages: 0 });
    await removeWbot(whatsapp.id, false);
  }
};

export { handleMessage };
