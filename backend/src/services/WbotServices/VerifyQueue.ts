import { AnyWASocket, proto } from "@ercsaczap/wa-connector";
import { Store } from "../../libs/store";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import { TranslateVariables } from "../TicketServices/TranslateVariables";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { verifyMessage } from "./wbotMessageListener";
import { head, chunk } from "lodash";
import { logger } from "../../utils/logger";

type Session = AnyWASocket & {
  id?: number;
  store?: Store;
};

export async function VerifyQueue(
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact
) {
  try {
    const setting = await Setting.findOne({
      where: { key: "queuesOptionType", companyId: ticket.companyId }
    });

    logger.info(
      `VerifyQueue -> Ticket ${ticket.id} -> Contact ${
        contact.name
      } -> Mensagem: ${JSON.stringify(msg?.message)}`
    );

    const receivedOption =
      msg?.message?.buttonsResponseMessage?.selectedButtonId ||
      msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg?.message?.extendedTextMessage?.text ||
      msg?.message?.conversation;

    const selectedButtonId = `${receivedOption}`.replace(/\D/g, "");

    console.log(`VerifyQueue: selectedButtonId`, selectedButtonId);

    logger.info(
      `VerifyQueue -> Ticket ${ticket.id} -> Contact ${contact.name} -> Mensagem: ${receivedOption}`
    );

    const { queues, greetingMessage } = await ShowWhatsAppService(
      wbot.id!,
      ticket.companyId
    );

    if (queues.length === 1) {
      logger.info(
        `VerifyQueue -> Ticket ${ticket.id} -> Contact ${
          contact.name
        } -> queues.length > 1: ${queues.length === 1}`
      );
      const firstQueue = head(queues);
      let chatbot = false;
      if (firstQueue?.options) {
        chatbot = firstQueue.options.length > 0;
      }

      await UpdateTicketService({
        ticketData: { queueId: firstQueue?.id, chatbot },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });

      if (
        !chatbot &&
        firstQueue.greetingMessage !== "" &&
        firstQueue.greetingMessage !== null
      ) {
        const body = TranslateVariables(firstQueue.greetingMessage, {
          contact,
          ticket
        });

        logger.info(
          `VerifyQueue -> Ticket ${ticket.id} -> Contact ${contact.name} -> !chatbot && firstQueue -> sendMessage: ${body}`
        );

        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );
        await verifyMessage(sentMessage, ticket);
      }

      return;
    }

    const choosenQueue = queues[+selectedButtonId - 1];

    if (choosenQueue) {
      let chatbot = false;
      if (choosenQueue?.options) {
        chatbot = choosenQueue.options.length > 0;
      }

      logger.info(
        `VerifyQueue -> Ticket ${ticket.id} -> Contact ${contact.name} -> choosenQueue: ${choosenQueue}`
      );

      await UpdateTicketService({
        ticketData: { queueId: choosenQueue.id, chatbot },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });

      if (choosenQueue.options.length == 0) {
        const body = `\u200e${choosenQueue.greetingMessage}`;

        const text = TranslateVariables(body, {
          ticket,
          contact
        });

        logger.info(
          `VerifyQueue -> Ticket ${ticket.id} -> Contact ${contact.name} -> choosenQueue.options.length == 0 -> message: ${text}`
        );

        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text
          }
        );
        await verifyMessage(sentMessage, ticket);
      }
    } else {
      logger.info(
        `VerifyQueue -> Ticket ${ticket.id} -> Contact ${contact.name} -> rotina do chatbot`
      );

      const listMessage = {
        text: "Escolha uma das filas abaixo para iniciar o atendimento",
        footer: "",
        title: "Atendimento",
        buttonText: "Opções disponíveis",
        sections: [
          {
            title: "Escolha uma das opções",
            rows: []
          }
        ]
      };

      let textList = TranslateVariables(greetingMessage, {
        ticket,
        contact
      });

      textList += "\n\n";

      let index = 0;
      let groupIndex = 0;
      for (let list of chunk(queues, 3)) {
        const buttons = [];
        const text = TranslateVariables(
          groupIndex === 0 ? greetingMessage : "Mais opções👇",
          {
            ticket,
            contact
          }
        );
        const buttonMessage = {
          text: text || "Escolha uma opção",
          footer: "",
          buttons: [],
          headerType: 1
        };

        for (let queue of list) {
          buttons.push({
            buttonId: index + 1,
            buttonText: { displayText: queue.name },
            type: 1
          });
          listMessage.sections[0].rows.push({
            rowId: index + 1,
            title: queue.name
          });
          textList += `${index + 1} - ${queue.name}\n`;
          index++;
        }

        if (setting && setting.value === "BUTTON_LIST") {
          buttonMessage.buttons = buttons;

          const sentMessage = await wbot.sendMessage(
            `${ticket.contact.number}@${
              ticket.isGroup ? "g.us" : "s.whatsapp.net"
            }`,
            buttonMessage
          );
          verifyMessage(sentMessage, ticket);
          groupIndex++;
        }
      }

      listMessage.text = TranslateVariables(greetingMessage, {
        ticket,
        contact
      });

      if (setting && setting.value === "OPTION_LIST") {
        const sentMessage = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          listMessage
        );
        verifyMessage(sentMessage, ticket);
      } else if (setting && setting.value === "TEXT_LIST") {
        const sentMessage = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          {
            text: textList
          }
        );
        verifyMessage(sentMessage, ticket);
      }
    }
  } catch (error) {
    logger.error(`VerifyQueue -> error: ${error.message}`);
    logger.error(`VerifyQueue -> stack: ${error.stack}`);
  }
}
