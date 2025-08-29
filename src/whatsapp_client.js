import http from './http.js';
import config from './config.js';
import { sendBaileysMessage } from './whatsapp_baileys.js';
import { logger } from './logger.js';

async function sendWhatsAppMessage({ waNumberId, to, text }) {
  if (config.whatsapp.provider === 'baileys') {
    try {
      await sendBaileysMessage({ to, text });
      return;
    } catch (err) {
      logger.error({ err }, 'Error sending WhatsApp message via Baileys');
      return;
    }
  }

  const url = `https://graph.facebook.com/v19.0/${waNumberId}/messages`;
  try {
    await http.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    logger.error({ err: err?.response?.data || err.message }, 'Error sending WhatsApp message via Cloud API');
  }
}

// Obtener metadatos del media (incluye URL temporal) a partir de media_id
async function getMediaMeta(mediaId) {
  const url = `https://graph.facebook.com/v19.0/${mediaId}`;
  const { data } = await http.get(url, {
    params: { access_token: config.whatsapp.accessToken }
  });
  // data: { url, mime_type, sha256, file_size, id }
  return data;
}

// Descargar el binario del media usando la URL y el token
async function downloadMediaBuffer(mediaUrl) {
  const res = await http.get(mediaUrl, {
    responseType: 'arraybuffer',
    headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` }
  });
  return Buffer.from(res.data, 'binary');
}

export { sendWhatsAppMessage, getMediaMeta, downloadMediaBuffer };