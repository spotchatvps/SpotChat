import Queue from "bull";
import * as Sentry from "@sentry/node";
import Schedule from "../models/Schedule";
import moment from "moment";
import { Op } from "sequelize";

import { REDIS_URI_CONNECTION } from "../config/redis";

import { logger } from "../utils/logger";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import Contact from "../models/Contact";
import { SendMessage } from "../helpers/SendMessage";

export const sendScheduledMessages = new Queue(
  "SendSacheduledMessages",
  REDIS_URI_CONNECTION
);

export const scheduleMonitor = new Queue(
  "ScheduleMonitor",
  REDIS_URI_CONNECTION
);

async function handleSendScheduledMessage(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e) {
    Sentry.captureException(e);
    logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
  }

  try {
    const whatsapp = await GetDefaultWhatsApp(schedule.companyId);

    await SendMessage(whatsapp, {
      number: schedule.contact.number,
      body: schedule.body
    });

    await scheduleRecord?.update({
      sentAt: moment().format("YYYY-MM-DD HH:mm"),
      status: "ENVIADA"
    });

    logger.info(`Mensagem agendada enviada para: ${schedule.contact.name}`);
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      status: "ERRO"
    });
    logger.error("SendScheduledMessage -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifySchedules(job) {
  try {
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        status: "PENDENTE",
        sentAt: null,
        sendAt: {
          [Op.gte]: moment().format("YYYY-MM-DD HH:mm:ss"),
          [Op.lte]: moment().add("30", "seconds").format("YYYY-MM-DD HH:mm:ss")
        }
      },
      include: [{ model: Contact, as: "contact" }]
    });
    if (count > 0) {
      schedules.map(async schedule => {
        await schedule.update({
          status: "AGENDADA"
        });
        sendScheduledMessages.add(
          "SendMessage",
          { schedule },
          {
            priority: 2,
            delay: 40000,
            removeOnComplete: { age: 60 * 60, count: 10 },
            removeOnFail: { age: 60 * 60, count: 10 }
          }
        );
        logger.info(`Disparo agendado para: ${schedule.contact.name}`);
      });
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendScheduledMessage -> Verify: error", e.message);
    throw e;
  }
}

sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);
scheduleMonitor.process("Verify", handleVerifySchedules);

export async function initScheduleQueues() {
  await scheduleMonitor.obliterate({ force: true });
  scheduleMonitor.add(
    "Verify",
    {},
    {
      repeat: { cron: "*/5 * * * * *" },
      removeOnComplete: true
    }
  );
  logger.info("Queue: monitoramento de agendamentos inicializado");
}
