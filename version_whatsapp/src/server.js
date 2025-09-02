import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config.js';
import { httpLogger, logger } from './logger.js';

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

// Endpoint para obtener posts de Instagram cuando provider=web
if (config.instagram.provider === 'web') {
  app.get('/instagram/:username/posts', async (req, res) => {
    try {
      const { getInstagramPosts } = await import('./platforms/instagram.js');
      const { username } = req.params;
      const first = Number.parseInt(req.query.first, 10) || 12;
      const posts = await getInstagramPosts({ username, first });
      res.json({ ok: true, username, count: posts.length, posts });
    } catch (err) {
      logger.error({ err }, 'Error fetching Instagram posts');
      res.status(500).json({ ok: false, error: err?.message || 'Unknown error' });
    }
  });
}

app.listen(config.port, async () => {
  logger.info({ port: config.port }, `Server running on port ${config.port}`);
  // Inicializar Baileys (único proveedor de WhatsApp)
  const { initBaileys } = await import('./whatsapp_baileys.js');
  await initBaileys();
});