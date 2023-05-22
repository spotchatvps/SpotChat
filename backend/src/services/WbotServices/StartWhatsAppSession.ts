import { initWASocket } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import * as Sentry from "@sentry/node";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.emit(`company-${companyId}-whatsappSession`, {
    action: "update",
    session: whatsapp
  });

  try {
    await initWASocket(whatsapp);
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};
