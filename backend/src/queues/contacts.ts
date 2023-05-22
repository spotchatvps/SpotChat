import Queue from "bull";
import * as Sentry from "@sentry/node";

import { REDIS_URI_CONNECTION } from "../config/redis";

import { getWbot } from "../libs/wbot";
import Contact from "../models/Contact";

export const contactQueue = new Queue("ContactQueue", REDIS_URI_CONNECTION);

async function handleFindPicture(job) {
  const { msgContactId, contactId, whatsappId } = job.data;
  const wbot = await getWbot(whatsappId);
  let contact = null;

  let profilePicUrl: string;
  try {
    contact = await Contact.findByPk(contactId);

    if (contact.profilePicUrl !== null && contact.profilePicUrl !== "") {
      return;
    }

    profilePicUrl = await wbot.profilePictureUrl(msgContactId);
  } catch (e) {
    Sentry.captureException(e);
    profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  try {
    await contact.update({ profilePicUrl });
  } catch (e) {
    Sentry.captureException(e);
  }
}

contactQueue.process("FindPicture", handleFindPicture);
