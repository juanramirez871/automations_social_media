const express = require('express');
const config = require('./config');
const whatsapp = require('./whatsapp');

const app = express();

// Middlewares de parsing
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// Webhook de WhatsApp (verificación)
app.get('/webhook/whatsapp', whatsapp.verify);
// Webhook de WhatsApp (eventos)
app.post('/webhook/whatsapp', whatsapp.receive);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});