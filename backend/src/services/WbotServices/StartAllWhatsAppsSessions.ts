import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import * as Sentry from "@sentry/node";

export const StartAllWhatsAppsSessions = async (
  companyId: number
): Promise<void> => {
  try {
    const whatsapps = await ListWhatsAppsService({ companyId });

    let promises = [];

    if (whatsapps.length > 0) {
      whatsapps.forEach(whatsapp => {
        promises.push(StartWhatsAppSession(whatsapp, companyId));
      });
    }

    await Promise.all(promises);
  } catch (e) {
    Sentry.captureException(e);
  }
};
