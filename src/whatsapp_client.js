const axios = require('axios');
const config = require('./config');

async function sendWhatsAppMessage({ waNumberId, to, text }) {
  const url = `https://graph.facebook.com/v19.0/${waNumberId}/messages`;
  try {
    await axios.post(
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
    console.error('Error sending WhatsApp message:', err?.response?.data || err.message);
  }
}

// Obtener metadatos del media (incluye URL temporal) a partir de media_id
async function getMediaMeta(mediaId) {
  const url = `https://graph.facebook.com/v19.0/${mediaId}`;
  const { data } = await axios.get(url, {
    params: { access_token: config.whatsapp.accessToken }
  });
  // data: { url, mime_type, sha256, file_size, id }
  return data;
}

// Descargar el binario del media usando la URL y el token
async function downloadMediaBuffer(mediaUrl) {
  const res = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` }
  });
  return Buffer.from(res.data, 'binary');
}

module.exports = { sendWhatsAppMessage, getMediaMeta, downloadMediaBuffer };