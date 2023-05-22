import Queue from "bull";
import * as Sentry from "@sentry/node";

import {
  REDIS_URI_CONNECTION,
  REDIS_OPT_LIMITER_MAX,
  REDIS_OPT_LIMITER_DURATION
} from "../config/redis";

import { MessageData, SendMessage } from "../helpers/SendMessage";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import { cacheLayer } from "../libs/cache";

export const messageQueue = new Queue("MessageQueue", REDIS_URI_CONNECTION, {
  limiter: {
    max: REDIS_OPT_LIMITER_MAX as number,
    duration: REDIS_OPT_LIMITER_DURATION as number
  }
});

async function handleSendMessage(job) {
  try {
    const { data } = job;

    const whatsapp = await Whatsapp.findByPk(data.whatsappId);

    if (whatsapp == null) {
      throw Error("Whatsapp não identificado");
    }

    const messageData: MessageData = data.data;

    await SendMessage(whatsapp, messageData);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleStoreMessage(job) {
  const {
    data: { ticketId, body, quotedMsg, medias, companyId }
  } = job;
  try {
    const ticket = await ShowTicketService(ticketId, companyId);

    await cacheLayer.delFromPattern(
      `company:${companyId}:tickets:${ticketId}:*`
    );

    SetTicketMessagesAsRead(ticket);

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await SendWhatsAppMedia({ media, ticket });
        })
      );
    } else {
      await SendWhatsAppMessage({ body, ticket, quotedMsg });
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> StoreMessage: error", e.message);
    throw e;
  }
}

messageQueue.process("StoreMessage", handleStoreMessage);
messageQueue.process("SendMessage", handleSendMessage);
