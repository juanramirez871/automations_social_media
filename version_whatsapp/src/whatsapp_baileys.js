import * as Baileys from '@whiskeysockets/baileys';
const makeSocket = typeof Baileys.makeWASocket === 'function' ? Baileys.makeWASocket : Baileys.default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage } = Baileys;
import qrcode from 'qrcode-terminal';
import { logger } from './logger.js';

let sock;
let authReady = false;

export async function initBaileys() {
  logger.info('Inicializando Baileys...');
  const { state, saveCreds } = await useMultiFileAuthState('./baileys_auth');
  const { version } = await fetchLatestBaileysVersion();
  logger.info({ version }, 'Versión de Baileys');

  sock = makeSocket({
    auth: state,
    version,
    printQRInTerminal: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    logger.info({ connection, hasQR: !!qr }, 'Actualización de conexión');
    if (qr) {
      qrcode.generate(qr, { small: true });
      logger.info('Escanea el QR de WhatsApp mostrado arriba.');
    }
    if (connection === 'open') {
      authReady = true;
      logger.info('Conectado a WhatsApp (Baileys)');
      logger.info({ jid: sock?.user?.id }, 'Cuenta WhatsApp conectada');
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      logger.warn({ reason }, 'Conexión cerrada');
      if (reason !== DisconnectReason.loggedOut) {
        logger.warn('Reintentando conexión a Baileys en 2s...');
        setTimeout(initBaileys, 2000);
      } else {
        logger.error('Sesión cerrada. Borra ./baileys_auth para reautenticar.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    logger.info({ type, count: messages?.length || 0 }, 'Evento messages.upsert');
    if (!messages || !messages.length) {
      logger.warn('messages.upsert sin mensajes válidos');
      return;
    }
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      logger.info({ 
        index: i,
        messageId: m?.key?.id,
        from: m?.key?.remoteJid,
        fromMe: m?.key?.fromMe,
        participant: m?.key?.participant,
        messageKeys: Object.keys(m?.message || {}),
        pushName: m?.pushName
      }, 'Mensaje entrante detectado');
    }
    
    for (const m of messages) {
      try {
        const from = m?.key?.remoteJid;
        const rawMsg = m.message || {};
        const normalized = rawMsg?.ephemeralMessage?.message || rawMsg?.viewOnceMessage?.message || rawMsg?.viewOnceMessageV2?.message || rawMsg;
        const hasText = !!(normalized?.conversation || normalized?.extendedTextMessage?.text);
        const hasImage = !!normalized?.imageMessage;
        const hasVideo = !!normalized?.videoMessage;
        logger.info({ from, hasText, hasImage, hasVideo }, 'Procesando mensaje entrante');
        if (!normalized || m.key.fromMe) {
          logger.info({ from, fromMe: m.key.fromMe, id: m.key.id }, 'Mensaje ignorado (vacío o de la misma cuenta)');
          continue;
        }

        // Texto
        const text = normalized?.conversation || normalized?.extendedTextMessage?.text;
        if (text) {
          logger.info('Detectado texto entrante');
          const { handleIncomingWhatsAppMessage } = await import('./orchestrator.js');
          await handleIncomingWhatsAppMessage({
            message: { type: 'text', text: { body: text }, from },
            from,
            waNumberId: 'baileys',
          });
          logger.debug('Texto procesado por orquestador');
          continue;
        }

        // Imagen
        const img = normalized?.imageMessage;
        if (img) {
          const caption = img.caption || '';
          logger.info({ captionLen: caption.length }, 'Detectada imagen entrante');
          let buffer = Buffer.alloc(0);
          try {
            const stream = await downloadContentFromMessage(img, 'image');
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            logger.info({ bufferLen: buffer.length }, 'Imagen descargada');
          } catch (e) {
            logger.error({ err: e }, 'Error descargando imagen de Baileys');
          }
          const { handleIncomingWhatsAppMessage } = await import('./orchestrator.js');
          await handleIncomingWhatsAppMessage({
            message: { type: 'image', image: { caption }, from, _mediaBuffer: buffer },
            from,
            waNumberId: 'baileys',
          });
          logger.debug('Imagen procesada por orquestador');
          continue;
        }

        // Video
        const vid = normalized?.videoMessage;
        if (vid) {
          const caption = vid.caption || '';
          logger.info({ captionLen: caption.length }, 'Detectado video entrante');
          let buffer = Buffer.alloc(0);
          try {
            const stream = await downloadContentFromMessage(vid, 'video');
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            logger.info({ bufferLen: buffer.length }, 'Video descargado');
          } catch (e) {
            logger.error({ err: e }, 'Error descargando video de Baileys');
          }
          const { handleIncomingWhatsAppMessage } = await import('./orchestrator.js');
          await handleIncomingWhatsAppMessage({
            message: { type: 'video', video: { caption }, from, _mediaBuffer: buffer },
            from,
            waNumberId: 'baileys',
          });
          logger.debug('Video procesado por orquestador');
          continue;
        }

        logger.debug('Mensaje sin tipos soportados (ni texto/imagen/video)');
      } catch (err) {
        logger.error({ err }, 'Error procesando mensaje de Baileys');
      }
    }
  });

  logger.info('Listener messages.upsert registrado correctamente');
}

export async function sendBaileysMessage({ to, text }) {
  logger.info({ to }, 'Enviando mensaje por Baileys');
  if (!sock || !authReady) {
    logger.error('Baileys no inicializado o no autenticado');
    throw new Error('Baileys no inicializado o no autenticado');
  }
  await sock.sendMessage(to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`, { text });
  logger.debug('Mensaje enviado por Baileys');
}