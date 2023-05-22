import { AnyWASocket, WAMessage } from "@ercsaczap/wa-connector";
import { Store } from "../../libs/store";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import Ticket from "../../models/Ticket";
import { getMessageOptions } from "./SendWhatsAppMedia";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { VerifyQueue } from "./VerifyQueue";
import { isNil, head, chunk, debounce, trim, isString } from "lodash";
import moment from "moment";
import Setting from "../../models/Setting";
import { TranslateVariables } from "../TicketServices/TranslateVariables";
import Message from "../../models/Message";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Whatsapp from "../../models/Whatsapp";
import path from "path";

type Session = AnyWASocket & {
  id?: number;
  store?: Store;
};

export async function verifyOutOfHoursFromQueue(msg, ticket) {
  try {
    const scheduleType = await Setting.findOne({
      where: {
        companyId: ticket.companyId,
        key: "scheduleType"
      }
    });

    //Fluxo fora do expediente
    if (!msg.key.fromMe && scheduleType && ticket.queueId !== null) {
      /**
       * Tratamento para envio de mensagem quando a fila está fora do expediente
       */
      const queue = await Queue.findByPk(ticket.queueId);

      const { schedules }: any = queue;
      const now = moment();
      const weekday = now.format("dddd").toLowerCase();
      let schedule = null;

      if (Array.isArray(schedules) && schedules.length > 0) {
        schedule = schedules.find(
          s =>
            s.weekdayEn === weekday &&
            s.startTime !== "" &&
            s.startTime !== null &&
            s.endTime !== "" &&
            s.endTime !== null
        );
      }

      if (scheduleType.value === "queue" && !isNil(schedule)) {
        const startTime = moment(schedule.startTime, "HH:mm");
        const endTime = moment(schedule.endTime, "HH:mm");

        if (now.isBefore(startTime) || now.isAfter(endTime)) {
          return true;
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
  return false;
}

export async function verifyOutOfHoursFromCompany(msg, ticket) {
  try {
    const scheduleType = await Setting.findOne({
      where: {
        companyId: ticket.companyId,
        key: "scheduleType"
      }
    });

    const currentSchedule = await VerifyCurrentSchedule(ticket.companyId);

    //Tratamento para envio de mensagem quando a empresa está fora do expediente
    if (!msg.key.fromMe && scheduleType) {
      if (
        scheduleType.value === "company" &&
        !isNil(currentSchedule) &&
        (!currentSchedule || currentSchedule.inActivity === false)
      ) {
        return true;
      }
    }
  } catch (e) {
    console.log(e);
  }
  return false;
}

export async function verifyOutOfHoursSetup(ticket) {
  const scheduleType = await Setting.findOne({
    where: {
      companyId: ticket.companyId,
      key: "scheduleType"
    }
  });

  if (scheduleType) {
    return scheduleType.value;
  }

  return "disabled";
}

export async function handleOutOfHoursFromQueue(ticket, wbot) {
  try {
    const queue = await Queue.findByPk(ticket.queueId);
    const body =
      TranslateVariables(`${queue.outOfHoursMessage}`, {
        contact: ticket.contact,
        ticket
      }) || "Fora de expediente.";

    const ticketUpdated = await Ticket.findByPk(ticket.id);

    let sendMessageOutOfHours = true;

    if (ticketUpdated.lastMessageOutOfHours !== null) {
      const lastMessageOutOfHours = moment(ticketUpdated.lastMessageOutOfHours);
      const twoMinutesAgo = moment().subtract(2, "minutes");
      sendMessageOutOfHours = lastMessageOutOfHours.isBefore(twoMinutesAgo);
    }

    if (sendMessageOutOfHours) {
      const debouncedSentMessage = debounce(
        async () => {
          await wbot.sendMessage(
            `${ticket.contact.number}@${
              ticket.isGroup ? "g.us" : "s.whatsapp.net"
            }`,
            {
              text: body
            }
          );
          await Ticket.update(
            { lastMessageOutOfHours: moment() },
            { where: { id: ticket.id } }
          );
        },
        3000,
        ticket.id
      );
      debouncedSentMessage();
    }
  } catch (e) {
    console.log(e);
  }
}

export async function handleOutOfHoursFromCompany(ticket, wbot) {
  try {
    const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
    const body =
      TranslateVariables(`${whatsapp.outOfHoursMessage}`, {
        contact: ticket.contact,
        ticket
      }) || "Fora de expediente.";

    const ticketUpdated = await Ticket.findByPk(ticket.id);

    let sendMessageOutOfHours = true;

    if (ticketUpdated.lastMessageOutOfHours !== null) {
      const lastMessageOutOfHours = moment(ticketUpdated.lastMessageOutOfHours);
      const twoMinutesAgo = moment().subtract(2, "minutes");
      sendMessageOutOfHours = lastMessageOutOfHours.isBefore(twoMinutesAgo);
    }

    if (sendMessageOutOfHours) {
      const debouncedSentMessage = debounce(
        async () => {
          await wbot.sendMessage(
            `${ticket.contact.number}@${
              ticket.isGroup ? "g.us" : "s.whatsapp.net"
            }`,
            {
              text: body
            }
          );
          await Ticket.update(
            { lastMessageOutOfHours: moment() },
            { where: { id: ticket.id } }
          );
        },
        3000,
        ticket.id
      );
      debouncedSentMessage();
    }
  } catch (e) {
    console.log(e);
  }
}

export async function sendMessageOutOfHours(
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session
) {
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
  await ticket.update({ flowStatus: "QUEUE_SELECTED" });
}

async function isOutOfHours(ticket: Ticket, msg: WAMessage, wbot: Session) {
  const settingType = await verifyOutOfHoursSetup(ticket);
  if (settingType === "queue") {
    const outOfHours = await verifyOutOfHoursFromQueue(msg, ticket);
    if (outOfHours) {
      return true;
    }
  } else if (settingType === "company") {
    const outOfHours = await verifyOutOfHoursFromCompany(msg, ticket);
    if (outOfHours) {
      return true;
    }
  }
  return false;
}

async function getQueue(queueId: number) {
  const queue = await Queue.findByPk(queueId, {
    include: [
      {
        model: QueueOption,
        as: "options",
        where: { parentId: null },
        order: [
          ["option", "ASC"],
          ["createdAt", "ASC"]
        ]
      }
    ]
  });

  return queue;
}

function getSelectedOption(msg: WAMessage) {
  const receivedOption =
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.conversation;

  return `${receivedOption}`;
}

async function goToBeginning(ticket: Ticket, msg: WAMessage, wbot: Session) {
  await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
  await VerifyQueue(wbot, msg, ticket, ticket.contact);
  await sendMessageOutOfHours(ticket, msg, wbot);
}

async function goToAttendant(ticket: Ticket, msg: WAMessage, wbot: Session) {
  await UpdateTicketService({
    ticketData: { queueOptionId: null, chatbot: false },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });

  await wbot.sendMessage(
    `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    {
      text: "\u200eAguarde, você será atendido em instantes."
    }
  );

  const settingType = await verifyOutOfHoursSetup(ticket);
  if (settingType === "queue") {
    const outOfHours = await verifyOutOfHoursFromQueue(msg, ticket);
    if (outOfHours) {
      await handleOutOfHoursFromQueue(ticket, wbot);
    } else {
      await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        {
          text: "\u200eAguarde, você será atendido em instantes."
        }
      );
    }
  } else if (settingType === "company") {
    const outOfHours = await verifyOutOfHoursFromCompany(msg, ticket);
    if (outOfHours) {
      await handleOutOfHoursFromCompany(ticket, wbot);
    } else {
      await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        {
          text: "\u200eAguarde, você será atendido em instantes."
        }
      );
    }
  }
}

async function goBack(ticket: Ticket) {
  const option = await QueueOption.findByPk(ticket.queueOptionId);
  await ticket.update({ queueOptionId: option?.parentId });
}

async function chooseAnOption(
  queue: Queue,
  ticket: Ticket,
  selectedButtonId: string
) {
  let choosenOption: QueueOption;

  if (queue.optionType === "TEXT_LIST") {
    choosenOption = await QueueOption.findOne({
      where: {
        queueId: queue.id,
        option: selectedButtonId
      }
    });
  } else {
    if (!Number.isNaN(+selectedButtonId)) {
      choosenOption = await QueueOption.findByPk(+selectedButtonId);
    }
  }

  await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_RESPONDEND" });

  if (choosenOption) {
    const count = await QueueOption.count({
      where: { parentId: ticket.queueOptionId }
    });

    let option: any = {};
    if (count == 1) {
      option = await QueueOption.findOne({
        where: { parentId: ticket.queueOptionId }
      });
    } else {
      option = await QueueOption.findOne({
        where: {
          option: choosenOption?.option,
          parentId: ticket.queueOptionId
        }
      });
    }

    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }

    return;
  }

  if (isString(selectedButtonId)) {
    const count = await QueueOption.count({
      where: { parentId: ticket.queueOptionId }
    });

    let option: any = {};
    if (count == 1) {
      option = await QueueOption.findOne({
        where: {
          parentId: ticket.queueOptionId
        }
      });

      if (option) {
        await ticket.update({ queueOptionId: option?.id });
      }
    }
  }
}

async function getParentOptions(ticket: Ticket) {
  return await QueueOption.findAll({
    where: { queueId: ticket.queueId, parentId: null },
    order: [
      ["option", "ASC"],
      ["createdAt", "ASC"]
    ]
  });
}

async function getSubOptions(ticket: Ticket) {
  return await QueueOption.findAll({
    where: { parentId: ticket.queueOptionId },
    order: [
      ["option", "ASC"],
      ["createdAt", "ASC"]
    ]
  });
}

async function sendFileIfDefined(
  currentOption: QueueOption,
  ticket: Ticket,
  wbot: Session
) {
  if (currentOption.path !== null && currentOption.path !== "") {
    const filePath = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      currentOption.path
    );
    const options = await getMessageOptions(currentOption.path, filePath);
    await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      { ...options }
    );
  }
}

async function verifyAndSendMessage(
  queueOption: QueueOption,
  wbot: Session,
  ticket: Ticket
) {
  const lastQueueMessage = await getLastMessageFromMe();
  const currentOptionMessage = queueOption.message || queueOption.title;

  if (trim(lastQueueMessage) !== trim(currentOptionMessage)) {
    await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      { text: currentOptionMessage }
    );
  }
}

async function getLastMessageFromMe() {
  const lastQueueMessage = await Message.findOne({
    where: { fromMe: true },
    limit: 1,
    order: [["createdAt", "DESC"]]
  });

  return trim(lastQueueMessage.body);
}

async function sendOtherOptionsFromCurrentOption(
  currentOption: QueueOption,
  ticket: Ticket,
  wbot: Session
) {
  const subOptions = await getSubOptions(ticket);
  if (currentOption.optionType == "TEXT_LIST") {
    await otherTextOptions(subOptions, ticket, wbot);
  } else if (currentOption.optionType == "OPTION_LIST") {
    await otherListOptions(subOptions, ticket, wbot);
  } else if (currentOption.optionType == "BUTTON_LIST") {
    await otherButtonOptions(subOptions, ticket, wbot);
  }
}

async function noOptionsFlow(
  currentOption: QueueOption,
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session
) {
  if (ticket.queueOptionId !== currentOption.id) {
    //Caso sejam iguais, essa mensagem já foi enviada anteriormente
    await verifyAndSendMessage(currentOption, wbot, ticket);
  }

  if (ticket.queueOptionId === currentOption.id) {
    const outOfHours = await isOutOfHours(ticket, msg, wbot);

    if (currentOption.finalize) {
      await UpdateTicketService({
        ticketData: { status: "closed" },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });
      await ticket.update({ flowStatus: "FINISHED" });
      return;
    }

    if (currentOption.waitTreatment) {
      await UpdateTicketService({
        ticketData: { chatbot: false, queueOptionId: null },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });

      if (outOfHours) {
        await sendMessageOutOfHours(ticket, msg, wbot);
      } else {
        await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          {
            text: "\u200eAguarde, você será atendido em instantes."
          }
        );
        await ticket.update({ flowStatus: "QUEUE_SELECTED" });
      }
      return;
    }

    if (outOfHours) {
      await sendMessageOutOfHours(ticket, msg, wbot);
    } else {
      // Fluxo de exibição de outras opções
      await sendOtherOptionsFromCurrentOption(currentOption, ticket, wbot);
    }
  }
}

async function onlyOneOptionFlow(
  currentOption: QueueOption,
  ticket: Ticket,
  wbot: Session
) {
  await verifyAndSendMessage(currentOption, wbot, ticket);
  await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_PENDING" });
}

async function doesNotListTheFirstOption(
  queue: Queue,
  ticket: Ticket,
  selectedButtonId: string
) {
  let option: QueueOption;

  if (queue.optionType === "TEXT_LIST") {
    option = await QueueOption.findOne({
      where: {
        queueId: queue.id,
        parentId: null,
        option: selectedButtonId
      }
    });
  opcoesFinais += "0 - Voltar\n";
  opcoesFinais += "00 - Menu inicial\n";
  } else {
    option = await QueueOption.findByPk(+selectedButtonId);
  }
  if (option) {
    await ticket.update({ queueOptionId: option?.id });
  }
}

async function otherTextOptions(
  subOptions: QueueOption[],
  ticket: Ticket,
  wbot: Session
) {
  // Fluxo de exibição de outras opções
  let opcoesFinais = "Outras Opções \n\n";

  opcoesFinais += "0 - Voltar\n";
  opcoesFinais += "00 - Menu inicial\n";

  if (subOptions.length <= 1) {
    opcoesFinais += "# - Falar com o atendente\n";
  }

  await wbot.sendMessage(
    `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    {
      text: opcoesFinais
    }
  );
  await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_PENDING" });
}

async function otherListOptions(
  subOptions: QueueOption[],
  ticket: Ticket,
  wbot: Session
) {
  // Fluxo de exibição de outras opções
  const opcoesFinais = {
    text: "\u200cOutras Opções",
    footer: "",
    buttons: [
      {
        buttonId: `0`,
        buttonText: { displayText: "Voltar" },
        type: 1
      },
      {
        buttonId: `00`,
        buttonText: { displayText: "Menu inicial" },
        type: 1
      }
    ],
    headerType: 1
  };

  if (subOptions.length <= 1) {
    opcoesFinais.buttons.push({
      buttonId: `#`,
      buttonText: { displayText: "Falar com o atendente" },
      type: 1
    });
  }

  await wbot.sendMessage(
    `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    opcoesFinais
  );
  await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_PENDING" });
}

async function otherButtonOptions(
  subOptions: QueueOption[],
  ticket: Ticket,
  wbot: Session
) {
  // Fluxo de exibição de outras opções
  const opcoesFinais = {
    text: "\u200cOutras Opções",
    footer: "",
    buttons: [
      {
        buttonId: `0`,
        buttonText: { displayText: "Voltar" },
        type: 1
      },
      {
        buttonId: `00`,
        buttonText: { displayText: "Menu inicial" },
        type: 1
      }
    ],
    headerType: 1
  };

  if (subOptions.length <= 1) {
    opcoesFinais.buttons.push({
      buttonId: `#`,
      buttonText: { displayText: "Falar com o atendente" },
      type: 1
    });
  }

  await wbot.sendMessage(
    `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    opcoesFinais
  );
  await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_PENDING" });
}

async function textFlow(
  queue: Queue,
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session
) {
  const parentOptionList = await getParentOptions(ticket);

  // nenhuma opção foi escolhida ainda
  if (isNil(ticket.queueOptionId)) {
    let textList = `${queue.greetingMessage}\n\n` || "Atendimento\n\n";

    for (let option of parentOptionList) {
      textList += `${option.option} - ${option.title}\n`;
    }

    await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: textList
      }
    );
    await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_PENDING" });
  } else {
    // uma opção foi escolhida
    let currentOption = await QueueOption.findByPk(ticket.queueOptionId);

    const subOptions = await getSubOptions(ticket);

    let textList = `${currentOption.message}` || `${currentOption.title}`;
    textList += "\n\n";

    // envia arquivo caso exista
    await sendFileIfDefined(currentOption, ticket, wbot);

    if (subOptions.length == 1) {
      // fluxo quando existe apenas uma opção
      const firstOption = head(subOptions);
      if (firstOption) {
        await onlyOneOptionFlow(firstOption, ticket, wbot);
        return;
      }
    } else if (subOptions.length > 1) {
      // fluxo quando existe mais de uma opção
      subOptions.forEach(option => {
        textList += `${option.option} - ${option.title}\n`;
      });

      await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        {
          text: textList
        }
      );

      // Fluxo de exibição de outras opções
      await otherTextOptions(subOptions, ticket, wbot);
    } else if (subOptions.length == 0) {
      await noOptionsFlow(currentOption, ticket, msg, wbot);
    }
  }
}

async function listFlow(
  queue: Queue,
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session
) {
  const parentOptionList = await getParentOptions(ticket);

  let initialMessage = queue.greetingMessage || "Atendimento";
  initialMessage += "\n\n";

  const listMessage = {
    text: "",
    footer: "",
    title: initialMessage,
    buttonText: "Opções disponíveis",
    sections: [
      {
        title: "Escolha uma das opções",
        rows: []
      }
    ]
  };

  // nenhuma opção foi escolhida ainda
  if (isNil(ticket.queueOptionId)) {
    parentOptionList.forEach((option, i) => {
      listMessage.sections[0].rows.push({
        rowId: option?.id,
        title: option?.title
      });
    });

    await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      listMessage
    );
    await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_PENDING" });
  } else {
    // uma opção foi escolhida
    let currentOption = await QueueOption.findByPk(ticket.queueOptionId);

    const listMessage = {
      text: currentOption.message,
      footer: "",
      title: currentOption.title,
      buttonText: "Opções disponíveis",
      sections: [
        {
          title: "Escolha uma das opções",
          rows: []
        }
      ]
    };

    const subOptions = await getSubOptions(ticket);

    // envia arquivo caso exista
    await sendFileIfDefined(currentOption, ticket, wbot);

    if (subOptions.length == 1) {
      // fluxo quando existe apenas uma opção
      const firstOption = head(subOptions);
      if (firstOption) {
        await onlyOneOptionFlow(firstOption, ticket, wbot);
        return;
      }
    } else if (subOptions.length > 1) {
      // fluxo quando existe mais de uma opção
      subOptions.forEach((option, i) => {
        listMessage.sections[0].rows.push({
          rowId: option?.id,
          title: option?.title
        });
      });

      await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        listMessage
      );

      await otherListOptions(subOptions, ticket, wbot);
    } else if (subOptions.length == 0) {
      await noOptionsFlow(currentOption, ticket, msg, wbot);
    }
  }
}

async function buttonsFlow(
  queue: Queue,
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session
) {
  const parentOptionList = await getParentOptions(ticket);

  let initialMessage = queue.greetingMessage || "Escolha uma opção";
  initialMessage += "\n\n";

  // nenhuma opção foi escolhida ainda
  if (isNil(ticket.queueOptionId)) {
    let groupIndex = 0;
    for (let partialOptions of chunk(parentOptionList, 3)) {
      const buttons = [];
      const buttonMessage = {
        text: initialMessage,
        footer: "",
        buttons: [],
        headerType: 1
      };

      partialOptions.forEach((option, i) => {
        buttons.push({
          buttonId: option?.id,
          buttonText: { displayText: option.title },
          type: 1
        });
      });

      buttonMessage.buttons = buttons;

      if (groupIndex > 0) {
        buttonMessage.text = "Mais opções👇";
      }

      await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        buttonMessage
      );

      groupIndex++;
    }
    await ticket.update({ flowStatus: "CHATBOT_CUSTOMER_PENDING" });
  } else {
    // uma opção foi escolhida
    let currentOption = await QueueOption.findByPk(ticket.queueOptionId);

    const subOptions = await getSubOptions(ticket);

    // envia arquivo caso exista
    await sendFileIfDefined(currentOption, ticket, wbot);

    if (subOptions.length == 1) {
      // fluxo quando existe apenas uma opção
      const firstOption = head(subOptions);
      if (firstOption) {
        await onlyOneOptionFlow(firstOption, ticket, wbot);
        return;
      }
    } else if (subOptions.length > 1) {
      // fluxo quando existe mais de uma opção
      let groupIndex = 0;
      for (let partialOptions of chunk(subOptions, 3)) {
        const buttons = [];
        const buttonMessage = {
          text:
            currentOption.message || currentOption.title || "Escolha uma opção",
          footer: "",
          buttons: [],
          headerType: 1
        };

        buttonMessage.footer = queue.name;

        partialOptions.forEach((option, i) => {
          buttons.push({
            buttonId: option?.id,
            buttonText: { displayText: option.title },
            type: 1
          });
        });

        buttonMessage.buttons = buttons;

        if (buttonMessage.buttons.length > 0) {
          if (groupIndex !== 0) {
            buttonMessage.text = "Mais opções👇";
          }
          await wbot.sendMessage(
            `${ticket.contact.number}@${
              ticket.isGroup ? "g.us" : "s.whatsapp.net"
            }`,
            buttonMessage
          );
        }

        groupIndex++;
      }

      await otherButtonOptions(subOptions, ticket, wbot);
    } else if (subOptions.length == 0) {
      await noOptionsFlow(currentOption, ticket, msg, wbot);
    }
  }
}

export async function HandleChatbot(
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session,
  dontReadTheFirstQuestion: boolean = false
) {
  try {
    const queue = await getQueue(ticket.queueId);

    const selectedButtonId = getSelectedOption(msg);

    if (selectedButtonId == "#") {
      // falar com o(a) atendente
      await goToAttendant(ticket, msg, wbot);
      return;
    }

    if (selectedButtonId == "00") {
      // ir para a opção inicial
      await goToBeginning(ticket, msg, wbot);
      return;
    }

    if (selectedButtonId == "0") {
      // volta para a opção anterior
      await goBack(ticket);
    }

    if (isNil(ticket.queueOptionId) && !dontReadTheFirstQuestion) {
      // não lista a primeira pergunta
      await doesNotListTheFirstOption(queue, ticket, selectedButtonId);
    } else if (!isNil(ticket.queueOptionId)) {
      // escolheu uma opção
      await chooseAnOption(queue, ticket, selectedButtonId);
    }

    // recarrega dados do ticket
    await ticket.reload();

    if (queue.optionType == "TEXT_LIST") {
      textFlow(queue, ticket, msg, wbot);
    }

    if (queue.optionType == "OPTION_LIST") {
      listFlow(queue, ticket, msg, wbot);
    }

    if (queue.optionType == "BUTTON_LIST") {
      buttonsFlow(queue, ticket, msg, wbot);
    }
  } catch (error) {
    console.error(`HandleChatbot -> error -> message: ${error.message}`);
    console.error(`HandleChatbot -> error -> stack: ${error.stack}`);
  }
}
