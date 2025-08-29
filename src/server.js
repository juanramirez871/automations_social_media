import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config.js';
import { httpLogger, logger } from './logger.js';
import { verify as verifyWhatsApp, receive as receiveWhatsApp } from './whatsapp_router.js';

const app = express();

// Seguridad básica
app.use(helmet());

// Logging HTTP estructurado
app.use(httpLogger);

// Middlewares de parsing
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Rate limiting (p. ej., 300 req/5min por IP)
const limiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 300 });
app.use(limiter);

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// Webhook de WhatsApp (solo necesario para provider cloud)
if (config.whatsapp.provider === 'cloud') {
  app.get('/webhook/whatsapp', verifyWhatsApp);
  app.post('/webhook/whatsapp', receiveWhatsApp);
}

app.listen(config.port, async () => {
  logger.info({ port: config.port }, `Server running on port ${config.port}`);
  if (config.whatsapp.provider === 'baileys') {
    const { initBaileys } = await import('./whatsapp_baileys.js');
    await initBaileys();
  }
});