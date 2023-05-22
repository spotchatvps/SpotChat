import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { isObject, isArray } from "lodash";
import moment from "moment";

interface Context {
  variables?: any[];
  contact?: Contact;
  ticket?: Ticket;
}

function salutation() {
  const currentHour = +moment().format("HH");
  if (currentHour >= 0 && currentHour <= 4) {
    return "Boa noite";
  }
  if (currentHour >= 5 && currentHour <= 11) {
    return "Bom dia";
  }
  if (currentHour >= 12 && currentHour <= 17) {
    return "Boa tarde";
  }
  if (currentHour >= 18 && currentHour <= 23) {
    return "Boa noite";
  }
  return "Olá";
}

export function TranslateVariables(text: string, context: Context) {
  let finalMessage = text;
  const { variables, contact, ticket } = context;

  if (isObject(contact) && finalMessage.includes("{nome}")) {
    finalMessage = finalMessage.replace(/{nome}/g, contact.name);
  }

  if (isObject(contact) && finalMessage.includes("{email}")) {
    finalMessage = finalMessage.replace(/{email}/g, contact.email);
  }

  if (isObject(contact) && finalMessage.includes("{numero}")) {
    finalMessage = finalMessage.replace(/{numero}/g, contact.number);
  }

  if (isObject(ticket) && finalMessage.includes("{protocolo}")) {
    finalMessage = finalMessage.replace(/{protocolo}/g, ticket.protocol);
  }

  if (finalMessage.includes("{saudacao}")) {
    finalMessage = finalMessage.replace(/{saudacao}/g, salutation());
  }

  if (isArray(variables)) {
    variables.forEach(variable => {
      if (finalMessage.includes(`{${variable.key}}`)) {
        const regex = new RegExp(`{${variable.key}}`, "g");
        finalMessage = finalMessage.replace(regex, variable.value);
      }
    });
  }

  return finalMessage;
}
