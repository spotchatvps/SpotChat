import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot, sessions } from "../../libs/wbot";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

interface IOnWhatsapp {
  jid: string;
  exists: boolean;
}

const checker = async (number: string, wbot: any) => {
  const [validNumber] = await wbot.onWhatsApp(`${number}@s.whatsapp.net`);
  return validNumber;
};

const CheckContactNumber = async (
  number: string,
  companyId: number
): Promise<IOnWhatsapp> => {
  try {
    logger.info("Sessões ativas: " + sessions.length);
    const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

    const wbot = getWbot(defaultWhatsapp.id);
    const isNumberExists = await checker(number, wbot);

    if (isNumberExists === undefined || !isNumberExists.exists) {
      throw new AppError("Número Inválido: " + number);
    }
    return isNumberExists;
  } catch (e) {
    Sentry.captureException(e);
    logger.error(e);
  }
};

export default CheckContactNumber;
