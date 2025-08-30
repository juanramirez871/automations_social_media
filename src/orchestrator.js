import { planPost } from './ai.js';
import { postToFacebook } from './platforms/facebook.js';
import { postToInstagram } from './platforms/instagram.js';
import { postToX } from './platforms/x.js';
import { sendBaileysMessage } from './whatsapp_baileys.js';
import { uploadFromUrl, uploadBuffer, deleteMedia } from './media_store.js';
import { logger } from './logger.js';
import config from './config.js';

/*
  Entradas desde WhatsApp:
  - Texto con redes destino y brief.
  - Medios opcionales (imagen/video) que pueden llegar como:
    a) Buffer binario desde Baileys (_mediaBuffer)
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

    // Hosting temporal en Cloudinary
    let uploaded = null;
    let publishMediaUrl = null;

    if (mediaType === 'image' || mediaType === 'video') {
      // Solo desde Baileys con buffer binario
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
      }

      if (!publishMediaUrl) {
        logger.warn('No se logró obtener/subir media. Verifique configuración de Cloudinary.');
      }
    }

    // Extraer plataformas explícitas del texto
    const explicitPlatforms = [];
    const textLower = (userText || '').toLowerCase();
    if (textLower.includes('facebook')) explicitPlatforms.push('facebook');
    if (textLower.includes('instagram')) explicitPlatforms.push('instagram');
    if (textLower.includes('twitter') || textLower.includes('x')) explicitPlatforms.push('x');

    // Plan con OpenAI
    const aiPlan = await planPost({ userPrompt: userText, mediaType });
    let platforms = explicitPlatforms.length ? explicitPlatforms : aiPlan.platforms;
    platforms = Array.from(new Set((platforms || []).map(p => String(p).toLowerCase()))).filter(p => ['facebook','instagram','x'].includes(p));
    logger.info({ platforms, mediaType, hasPublishMediaUrl: !!publishMediaUrl }, 'Plataformas seleccionadas');

    const captionBase = aiPlan.caption || userText || '';
    const hashtags = (aiPlan.hashtags || []).join(' ');
    const finalCaption = [captionBase, hashtags].filter(Boolean).join('\n\n');

    const results = [];

    for (const p of platforms) {
      try {
        if (p === 'facebook') {
          const fbRes = await postToFacebook({
            message: finalCaption,
            imageUrl: mediaType === 'image' ? publishMediaUrl : undefined,
            videoUrl: mediaType === 'video' ? publishMediaUrl : undefined,
          });
          results.push(fbRes);
        } else if (p === 'instagram') {
          if (!publishMediaUrl) throw new Error('No hay media disponible para Instagram');
          const igRes = await postToInstagram({
            caption: finalCaption,
            imageUrl: mediaType === 'image' ? publishMediaUrl : undefined,
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
        await deleteMedia(uploaded.publicId, mediaType === 'video' ? 'video' : 'image');
        logger.info({ publicId: uploaded.publicId }, 'Media eliminado de Cloudinary tras publicar');
      }
    }

    // Respuesta por WhatsApp (solo Baileys)
    if (results.length === 0) {
      await sendBaileysMessage({ to: fromNumber, text: 'No se detectaron plataformas válidas para publicar.' });
      logger.info('handleIncomingWhatsAppMessage: fin (sin plataformas)');
      return;
    }

    const lines = results.map(r =>
      r.error ? `❌ ${r.platform}: ${r.error}` : `✅ ${r.platform}: ${r.url || r.id}`
    );
    const mediaInfo = uploaded?.publicId ? `\nCloudinary: publicId=${uploaded.publicId}\nURL=${uploaded.secureUrl}` : '';
    const response = `Resumen de publicaciones:\n${lines.join('\n')}${mediaInfo}`;
    await sendBaileysMessage({ to: fromNumber, text: response });
    logger.info('handleIncomingWhatsAppMessage: fin (respuesta enviada)');
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