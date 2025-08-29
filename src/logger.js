import pino from 'pino';
import pinoHttp from 'pino-http';
import pretty from 'pino-pretty';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

let logger;
if (isProd) {
  logger = pino({ level });
} else {
  const prettyStream = pretty({ colorize: true, translateTime: 'SYS:standard' });
  logger = pino({ level }, prettyStream);
}

const httpLogger = pinoHttp({ logger });

export { logger, httpLogger };