import { FindOptions } from "sequelize/types";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Queue from "../../models/Queue";
import { cacheLayer } from "../../libs/cache";

interface Request {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  queues?: number[];
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  companyId,
  queues = []
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService(ticketId, companyId);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const options: FindOptions = {
    where: {
      ticketId,
      companyId
    }
  };

  if (queues.length > 0) {
    options.where["queueId"] = {
      [Op.or]: {
        [Op.in]: queues,
        [Op.eq]: null
      }
    };
  }

  const cache = await cacheLayer.getFromParams(
    `company:${companyId}:tickets:${ticketId}:messages`,
    {
      limit,
      offset,
      ticketId,
      companyId
    }
  );

  if (cache !== null) {
    const result = JSON.parse(cache);
    const ticket = await Ticket.findByPk(result.ticket.id);
    return { ...result, ticket };
  }

  const { count, rows: messages } = await Message.findAndCountAll({
    ...options,
    limit,
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      },
      {
        model: Queue,
        as: "queue"
      }
    ],
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + messages.length;

  const result = {
    messages: messages.reverse(),
    ticket,
    count,
    hasMore
  };

  cacheLayer.setFromParams(
    `company:${companyId}:tickets:${ticketId}:messages`,
    {
      limit,
      offset,
      ticketId,
      companyId
    },
    JSON.stringify(result),
    "EX",
    60 * 10
  );

  return result;
};

export default ListMessagesService;
