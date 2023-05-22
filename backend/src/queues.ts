import { initScheduleQueues } from "./queues/schedules";
import { initUserMonitorQueues } from "./queues/userMonitor";
import { logger } from "./utils/logger";

export async function startQueueProcess() {
  logger.info("Iniciando processamento de filas");

  initUserMonitorQueues();
  initScheduleQueues();
}
