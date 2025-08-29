import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { logger } from './logger.js';

let sock;
let authReady = false;

export async function initBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState('./baileys_auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
      logger.info('Escanea el QR de WhatsApp mostrado arriba.');
    }
    if (connection === 'open') {
      authReady = true;
      logger.info('Conectado a WhatsApp (Baileys)');
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        logger.warn({ reason }, 'Conexión cerrada, reintentando...');
        setTimeout(initBaileys, 2000);
      } else {
        logger.error('Sesión cerrada. Borra ./baileys_auth para reautenticar.');
      }
    }
  });

  // Listener de mensajes entrantes
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const from = m.key.remoteJid;
      const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
      // Aquí puedes enrutar al orquestador si deseas paridad con el flujo Cloud API:
      // import dinámico para evitar ciclo
      const { handleIncomingWhatsAppMessage } = await import('./orchestrator.js');
      await handleIncomingWhatsAppMessage({
        message: { type: 'text', text: { body: text }, from },
        from,
        waNumberId: 'baileys',
      });
    }
  });
}

export async function sendBaileysMessage({ to, text }) {
  if (!sock || !authReady) throw new Error('Baileys no inicializado o no autenticado');
  await sock.sendMessage(to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`, { text });
}