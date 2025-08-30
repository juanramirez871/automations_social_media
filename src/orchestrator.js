import { planPost } from './ai.js';
import { postToFacebook } from './platforms/facebook.js';
import { postToInstagram } from './platforms/instagram.js';
import { postToX } from './platforms/x.js';
import { sendBaileysMessage } from './whatsapp_baileys.js';
import { uploadFromUrl, uploadBuffer, deleteMedia } from './media_store.js';
import { logger } from './logger.js';
import config from './config.js';

// Sesiones en memoria por usuario (JID/numero) para flujo en 2 pasos
const pendingSessions = new Map(); // key = fromNumber, value = { mediaType, publishMediaUrl, uploaded, createdAt }

/*
  Nueva lógica de flujo (2 pasos):
  1) Usuario envía imagen o video -> subimos a Cloudinary, guardamos en sesión y respondemos: "✅ Recibido. Escribe tu prompt..."
  2) Usuario envía sólo texto con plataformas y brief -> generamos caption/hashtags y publicamos usando el media guardado.
*/
export async function handleIncomingWhatsAppMessage({ message, from, waNumberId }) {
  logger.info({ from, waNumberId, type: message?.type }, 'handleIncomingWhatsAppMessage: inicio');
  try {
    const fromNumber = message.from || from;

    let userText = '';
    let mediaType = null; // 'image' | 'video' | null

    if (message.type === 'text') {
      userText = message.text?.body || '';
    } else if (message.type === 'image') {
      mediaType = 'image';
      userText = message.image?.caption || '';
    } else if (message.type === 'video') {
      mediaType = 'video';
      userText = message.video?.caption || '';
    }

    logger.debug({ from: fromNumber, mediaType }, 'Incoming WhatsApp message');

    // CASO 1: Llega media (imagen/video) -> subir, guardar sesión y pedir prompt
    if (mediaType === 'image' || mediaType === 'video') {
      let uploaded = null;
      let publishMediaUrl = null;

      // Sólo disponible automáticamente con Baileys (buffer binario)
      const buffer = message._mediaBuffer;
      logger.debug({ bufLen: buffer?.length || 0 }, 'Baileys media buffer length');
      if (buffer && Buffer.isBuffer(buffer) && buffer.length) {
        try {
          uploaded = await uploadBuffer({ buffer, resourceType: mediaType });
          publishMediaUrl = uploaded.secureUrl;
          logger.info({ publishMediaUrl, publicId: uploaded?.publicId }, 'Media subido desde buffer a Cloudinary');
        } catch (e) {
          logger.error({ err: e }, 'Error subiendo media desde buffer de Baileys');
        }
      } else {
        logger.warn('No se detectó buffer de media (este flujo requiere Baileys para subir el archivo)');
      }

      if (publishMediaUrl) {
        // Si ya había una sesión, la reemplazamos por la nueva
        const hadPrev = pendingSessions.has(fromNumber);
        pendingSessions.set(fromNumber, {
          mediaType,
          publishMediaUrl,
          uploaded,
          createdAt: Date.now(),
        });
        const replaceNote = hadPrev ? '\n(Nueva media recibida: se reemplazó la anterior.)' : '';
        try {
          await sendBaileysMessage({
            to: fromNumber,
            text: `✅ Media recibida exitosamente.${replaceNote}\n\nAhora escribe tu prompt: indica plataformas (instagram, facebook, x) y una breve descripción del post.`,
          });
        } catch (e) {
          logger.error({ err: e }, 'Error enviando confirmación por WhatsApp');
        }
      } else {
        try {
          await sendBaileysMessage({
            to: fromNumber,
            text: '❌ No se pudo procesar el media. Por favor reenvía la imagen o el video.',
          });
        } catch (e) {
          logger.error({ err: e }, 'Error enviando fallo de recepción por WhatsApp');
        }
      }

      logger.info('handleIncomingWhatsAppMessage: fin (esperando prompt de texto)');
      return; // No publicamos aún, esperamos el prompt de texto
    }

    // CASO 2: Llega texto
    if (message.type === 'text') {
      const session = pendingSessions.get(fromNumber);
      if (!session) {
        // No hay media pendiente -> pedimos que envíe primero imagen/video
        try {
          await sendBaileysMessage({
            to: fromNumber,
            text: '¡Hola! 👋 Soy tu asistente para automatizar publicaciones en redes sociales ✨\n\nPuedo publicar en Instagram, Facebook y X a partir de lo que envíes por WhatsApp 📲\n\nPara empezar:\n1) Envía una foto 📸 o un video 🎬\n2) Luego te pediré tu prompt: plataformas (instagram, facebook, x) y una breve descripción del post 📝',
          });
        } catch (e) { logger.error({ err: e }, 'Error enviando instrucción inicial'); }
        logger.info('handleIncomingWhatsAppMessage: fin (sin sesión de media)');
        return;
      }

      // Usamos el media previamente subido desde la sesión
      const { mediaType: sessMediaType, publishMediaUrl, uploaded } = session;
      const promptText = userText || '';

      // Extraer plataformas explícitas del texto
      const explicitPlatforms = [];
      const textLower = (promptText || '').toLowerCase();
      if (textLower.includes('facebook')) explicitPlatforms.push('facebook');
      if (textLower.includes('instagram')) explicitPlatforms.push('instagram');
      if (textLower.includes('twitter') || textLower.includes('x')) explicitPlatforms.push('x');

      // Plan con OpenAI usando el prompt del usuario y el tipo de media almacenado
      const aiPlan = await planPost({ userPrompt: promptText, mediaType: sessMediaType });
      let platforms = explicitPlatforms.length ? explicitPlatforms : aiPlan.platforms;
      platforms = Array.from(new Set((platforms || []).map(p => String(p).toLowerCase()))).filter(p => ['facebook','instagram','x'].includes(p));
      logger.info({ platforms, mediaType: sessMediaType, hasPublishMediaUrl: !!publishMediaUrl }, 'Plataformas seleccionadas');

      const captionBase = aiPlan.caption || promptText || '';
      const hashtags = (aiPlan.hashtags || []).join(' ');
      const finalCaption = [captionBase, hashtags].filter(Boolean).join('\n\n');

      const results = [];

      for (const p of platforms) {
        try {
          if (p === 'facebook') {
            const fbRes = await postToFacebook({
              message: finalCaption,
              imageUrl: sessMediaType === 'image' ? publishMediaUrl : undefined,
              videoUrl: sessMediaType === 'video' ? publishMediaUrl : undefined,
            });
            results.push(fbRes);
          } else if (p === 'instagram') {
            if (!publishMediaUrl) throw new Error('No hay media disponible para Instagram');
            const igRes = await postToInstagram({
              caption: finalCaption,
              imageUrl: sessMediaType === 'image' ? publishMediaUrl : undefined,
              videoUrl: sessMediaType === 'video' ? publishMediaUrl : undefined,
            });
            results.push(igRes);
          } else if (p === 'x') {
            const xRes = await postToX({ text: finalCaption });
            results.push(xRes);
          }
        } catch (e) {
          results.push({ platform: p, error: e.message });
        }
      }

      logger.info({ results }, 'Resultados de publicación');

      // Limpieza: borrar el media temporal si hubo al menos una publicación exitosa
      const anySuccess = results.some(r => !r.error);
      if (anySuccess && uploaded?.publicId) {
        if (config.cloudinary.keepUploads) {
          logger.info({ publicId: uploaded.publicId, url: uploaded.secureUrl }, 'Conservando media en Cloudinary (keepUploads=true)');
        } else {
          await deleteMedia(uploaded.publicId, sessMediaType === 'video' ? 'video' : 'image');
          logger.info({ publicId: uploaded.publicId }, 'Media eliminado de Cloudinary tras publicar');
        }
      }

      // Respuesta por WhatsApp con resumen
      if (results.length === 0) {
        try { await sendBaileysMessage({ to: fromNumber, text: 'No se detectaron plataformas válidas para publicar.' }); } catch {}
        logger.info('handleIncomingWhatsAppMessage: fin (sin plataformas)');
        pendingSessions.delete(fromNumber); // limpiar sesión aunque no haya plataformas
        return;
      }

      const lines = results.map(r =>
        r.error ? `❌ ${r.platform}: ${r.error}` : `✅ ${r.platform}: ${r.url || r.id}`
      );
      const mediaInfo = uploaded?.publicId ? `\nCloudinary: publicId=${uploaded.publicId}\nURL=${uploaded.secureUrl}` : '';
      const response = `Resumen de publicaciones:\n${lines.join('\n')}${mediaInfo}`;
      try { await sendBaileysMessage({ to: fromNumber, text: response }); } catch {}

      // Limpiar sesión tras publicar
      pendingSessions.delete(fromNumber);
      logger.info('handleIncomingWhatsAppMessage: fin (publicación y limpieza de sesión)');
      return;
    }

    // Otros tipos no soportados
    try {
      await sendBaileysMessage({ to: fromNumber, text: 'Envía una imagen o un video para comenzar.' });
    } catch {}
    logger.info('handleIncomingWhatsAppMessage: fin (tipo no soportado)');
  } catch (err) {
    logger.error({ err }, 'Error en handleIncomingWhatsAppMessage');
    try {
      const to = from || message?.from;
      if (to) {
        await sendBaileysMessage({ to, text: 'Ocurrió un error procesando tu solicitud. Inténtalo más tarde.' });
      }
    } catch (e2) {
      logger.error({ err: e2 }, 'Error enviando mensaje de error por WhatsApp');
    }
  }
}