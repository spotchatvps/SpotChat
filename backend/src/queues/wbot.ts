import Queue from "bull";
import * as Sentry from "@sentry/node";
import { REDIS_URI_CONNECTION } from "../config/redis";
import {
  handleMessage,
  handleMsgAck,
  verifyAndReconnectWhatsapp
} from "../services/WbotServices/wbotMessageListener";
import Message from "../models/Message";
import { getWbot } from "../libs/wbot";
import { logger } from "../utils/logger";
import TicketTraking from "../models/TicketTraking";
import { Op } from "sequelize";
import moment from "moment";
import Ticket from "../models/Ticket";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import Whatsapp from "../models/Whatsapp";

export const wbotQueue = new Queue("WbotQueue", REDIS_URI_CONNECTION);

async function handleMessagesUpsert(job) {
  try {
    const { message, whatsappId } = job.data;
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (whatsapp) {
      const wbot = await getWbot(whatsappId);

      const messageExists = await Message.count({
        where: { id: message.key.id!, companyId: whatsapp.companyId }
      });

      if (!messageExists) {
        await handleMessage(message, wbot, whatsapp.companyId);
        await verifyAndReconnectWhatsapp(wbot);
      }
    }
  } catch (e: any) {
    logger.error(`wbot -> handleMessagesUpsert -> ${e.message}`);
    logger.error(e.stack);
  }
}

async function handleMessagesUpdate(job) {
  const { message } = job.data;

  try {
    await handleMsgAck(message, message.update.status);
  } catch (e: any) {
    logger.error(`wbot -> handleMessagesUpdate -> ${e.message}`);
    logger.error(e.stack);
  }
}

async function handlePendingEvaluation(job) {
  try {
    const trakings = await TicketTraking.findAll({
      where: {
        finishedAt: null,
        ratingAt: {
          [Op.ne]: null
        },
        rated: false
      }
    });
    logger.info(
      `handlePendingEvaluation -> trakings -> length -> ${trakings.length}`
    );
    const now = moment();
    for (let traking of trakings) {
      const ratingAt = moment(traking.ratingAt);
      const minutes = Math.abs(ratingAt.diff(now, "minutes"));
      logger.info(
        `handlePendingEvaluation -> trakings -> for -> ticket ${traking.ticketId} -> minutes -> ${minutes}`
      );
      if (minutes > 10) {
        const ticket = await Ticket.findByPk(traking.ticketId);

        await traking.update({
          finishedAt: moment().toDate()
        });

        await UpdateTicketService({
          ticketId: ticket.id,
          companyId: ticket.companyId,
          ticketData: {
            queueId: null,
            userId: null,
            status: "closed"
          },
          skipRating: true
        });
        logger.info(`Finalizando ticket pendente de avaliação: ${ticket.id}`);
      }
    }
  } catch (error) {
    logger.error(
      `handlePendingEvaluation -> trakings -> catch -> ${error.message}`
    );
    Sentry.captureException(error);
  }
}

wbotQueue.process("MessagesUpsert", handleMessagesUpsert);
wbotQueue.process("MessagesUpdate", handleMessagesUpdate);
wbotQueue.process("PendingEvaluation", handlePendingEvaluation);

export async function initWbotQueues() {
  await wbotQueue.obliterate({ force: true });
  wbotQueue.add(
    "PendingEvaluation",
    {},
    {
      priority: 1,
      repeat: { cron: "*/60 * * * * *" },
      removeOnComplete: { age: 60 * 60, count: 10 },
      removeOnFail: { age: 60 * 60, count: 10 }
    }
  );
  logger.info("Wbot: monitoramento de avaliações pendentes");
}
