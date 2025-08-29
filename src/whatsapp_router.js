import { z } from 'zod';
import { logger } from './logger.js';
import * as orchestrator from './orchestrator.js';
import config from './config.js';

// Esquemas de validación básicos para el webhook
const verifySchema = z.object({
  'hub.mode': z.string().optional(),
  'hub.verify_token': z.string().optional(),
  'hub.challenge': z.string().optional(),
});

export async function verify(req, res) {
  try {
    const parsed = verifySchema.parse(req.query);
    const VERIFY_TOKEN = config.whatsapp.verifyToken;
    const mode = parsed['hub.mode'];
    const token = parsed['hub.verify_token'];
    const challenge = parsed['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  } catch (err) {
    logger.error({ err }, 'Error on verify webhook');
    return res.sendStatus(500);
  }
}

const bodySchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z.array(z.object({
        value: z.object({
          messages: z.array(z.any()).optional(),
          metadata: z.object({ phone_number_id: z.string().optional() }).optional(),
        }).optional(),
      })).optional(),
    })
  ).optional(),
});

export async function receive(req, res) {
  try {
    const parsed = bodySchema.parse(req.body);

    if (parsed.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    // Responder 200 inmediatamente para evitar reintentos
    res.sendStatus(200);

    const entries = parsed.entry || [];
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
    logger.error({ err, body: req.body }, 'Error processing incoming WhatsApp message');
    // Si la validación falla, devolvemos 400; para otros errores 500
    if (err instanceof z.ZodError) return res.sendStatus(400);
    return res.sendStatus(500);
  }
}