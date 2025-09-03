import axios from 'axios';
import config from './config.js';
import * as orchestrator from './orchestrator.js';

export async function verify(req, res) {
  try {
    const VERIFY_TOKEN = config.whatsapp.verifyToken;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  } catch (err) {
    console.error('Error on verify webhook:', err.message);
    return res.sendStatus(500);
  }
}

export async function receive(req, res) {
  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    res.sendStatus(200);

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const messages = (value.messages || []).filter(m => m.type === 'text' || m.type === 'image' || m.type === 'video');
        const waNumberId = value.metadata?.phone_number_id || config.whatsapp.phoneNumberId;

        for (const msg of messages) {
          await orchestrator.handleIncomingWhatsAppMessage({
            message: msg,
            from: msg.from,
            waNumberId,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error processing incoming WhatsApp message:', err);
  }
}