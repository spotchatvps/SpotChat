import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import Company from "./models/Company";
import { startQueueProcess } from "./queues";
import { initWbotQueues } from "./queues/wbot";
import Proxy from "./models/Proxy";

const server = app.listen(process.env.PORT, async () => {
  await Proxy.update({ connections: 0 }, { where: {} });
  const companies = await Company.findAll();
  const allPromises: any[] = [];
  companies.map(async c => {
    const promise = StartAllWhatsAppsSessions(c.id);
    allPromises.push(promise);
  });

  Promise.all(allPromises).then(() => {
    startQueueProcess();
    initWbotQueues();
  });
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO(server);
gracefulShutdown(server);
