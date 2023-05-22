import pino from "pino";
import moment from "moment";

const logger = pino({
  timestamp: () => `,"time":"${moment().format("DD/MM/YYYY HH:mm:ss")}"`,
  prettyPrint: {
    ignore: "pid,hostname"
  }
});

export { logger };
