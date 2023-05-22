import moment from "moment";
import * as Sentry from "@sentry/node";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Setting from "../../models/Setting";
import Queue from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { verifyMessage } from "../WbotServices/wbotMessageListener";
import { isNil } from "lodash";
import { TranslateVariables } from "./TranslateVariables";
import { logger } from "../../utils/logger";
import TicketTag from "../../models/TicketTag";

interface TicketData {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  chatbot?: boolean;
  queueOptionId?: number;
  flowStatus?: string;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  companyId: number;
  skipRating?: boolean;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  companyId,
  skipRating = false
}: Request): Promise<Response> => {
  try {
    const { status, flowStatus } = ticketData;
    let { queueId, userId } = ticketData;
    let chatbot: boolean | null = ticketData.chatbot || false;
    let queueOptionId: number | null = ticketData.queueOptionId || null;

    const io = getIO();

    const key = "userRating";
    const setting = await Setting.findOne({
      where: {
        companyId,
        key
      }
    });

    const ticket = await ShowTicketService(ticketId, companyId);
    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId,
      companyId,
      whatsappId: ticket.whatsappId
    });

    await SetTicketMessagesAsRead(ticket);

    const oldStatus = ticket.status;
    const oldUserId = ticket.user?.id;
    const oldQueueId = ticket.queueId;

    if (oldStatus === "closed") {
      await CheckContactOpenTickets(ticket.contact.id);
      chatbot = null;
      queueOptionId = null;
    }

    if (status !== undefined && ["closed"].indexOf(status) > -1) {
      const { complationMessage, ratingMessage } = await ShowWhatsAppService(
        ticket.whatsappId,
        companyId
      );

      if (setting?.value === "enabled" && ticket.chatbot !== true) {
        if (ticketTraking.ratingAt == null && skipRating == false) {
          const ratingTxt = ratingMessage || "";
          let bodyRatingMessage = TranslateVariables(`\u200e${ratingTxt}\n\n`, {
            contact: ticket.contact,
            ticket
          });
          bodyRatingMessage +=
            "Digite de 1 à 3 para qualificar nosso atendimento:\n*1* - _Insatisfeito_\n*2* - _Satisfeito_\n*3* - _Muito Satisfeito_\n\n";
          await SendWhatsAppMessage({ body: bodyRatingMessage, ticket });

          await ticketTraking.update({
            ratingAt: moment().toDate()
          });

          await ticket.update({
            flowStatus: "EVALUATION"
          });

          io.to("open")
            .to(ticketId.toString())
            .emit(`company-${ticket.companyId}-ticket`, {
              action: "delete",
              ticketId: ticket.id
            });

          return { ticket, oldStatus, oldUserId };
        }
        ticketTraking.ratingAt = moment().toDate();
        ticketTraking.rated = false;
      }

      if (!isNil(complationMessage) && complationMessage !== "") {
        const body = TranslateVariables(`\u200e${complationMessage}`, {
          contact: ticket.contact,
          ticket
        });
        await SendWhatsAppMessage({ body, ticket });
      }

      await ticket.update({
        lastMessageOutOfHours: null,
        flowStatus: "FINISHED"
      });

      ticketTraking.finishedAt = moment().toDate();
      ticketTraking.whatsappId = ticket.whatsappId;
      ticketTraking.userId = ticket.userId;

      queueId = null;
      userId = null;
    }

    if (queueId !== undefined && queueId !== null) {
      ticketTraking.queuedAt = moment().toDate();
    }

    if (oldQueueId !== queueId && !isNil(oldQueueId) && !isNil(queueId)) {
      const queue = await Queue.findByPk(queueId);
      let body = `\u200e${queue?.greetingMessage}`;
      const wbot = await GetTicketWbot(ticket);

      const queueChangedMessage = await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        {
          text: "\u200eVocê foi transferido, em breve iremos iniciar seu atendimento."
        }
      );
      await verifyMessage(queueChangedMessage, ticket);

      // mensagem padrão desativada em caso de troca de fila
      // const sentMessage = await wbot.sendMessage(`${ticket.contact.number}@c.us`, body);
      // await verifyMessage(sentMessage, ticket, ticket.contact, companyId);
    }

    await ticket.update({
      status,
      flowStatus,
      queueId,
      userId,
      chatbot,
      queueOptionId
    });

    await ticket.reload();

    if (status !== undefined && ["pending"].indexOf(status) > -1) {
      ticketTraking.update({
        whatsappId: ticket.whatsappId,
        queuedAt: moment().toDate(),
        startedAt: null,
        userId: null
      });
    }

    if (status !== undefined && ["open"].indexOf(status) > -1) {
      ticketTraking.update({
        startedAt: moment().toDate(),
        ratingAt: null,
        rated: false,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
    }

    await ticketTraking.save();

    if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
      io.to(oldStatus).emit(`company-${companyId}-ticket`, {
        action: "delete",
        ticketId: ticket.id
      });
    }

    io.to(ticket.status)
      .to("notification")
      .to(ticketId.toString())
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return { ticket, oldStatus, oldUserId };
  } catch (err) {
    Sentry.captureException(err);
  }
};

export default UpdateTicketService;
