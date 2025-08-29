import { planPost } from './openai.js';
import { postToFacebook } from './platforms/facebook.js';
import { postToInstagram } from './platforms/instagram.js';
import { postToX } from './platforms/x.js';
import { sendWhatsAppMessage, getMediaMeta, downloadMediaBuffer } from './whatsapp_client.js';
import { uploadFromUrl, uploadBuffer, deleteMedia } from './media_store.js';
import { logger } from './logger.js';
import config from './config.js';

/*
  Entradas desde WhatsApp:
  - Texto con redes destino y brief.
  - Medios opcionales (imagen/video) que pueden llegar como:
    a) media_id nativo (WhatsApp Cloud API) -> hay que obtener URL temporal y descargar con token.
    b) URL pública (incluida en el texto o en el objeto) -> subir directo a Cloudinary por URL.
*/
export async function handleIncomingWhatsAppMessage({ message, from, waNumberId }) {
  try {
    const fromNumber = message.from;

    let userText = '';
    let mediaType = null; // 'image' | 'video' | null
    let mediaUrl = null;  // URL pública si existiera
    let mediaId = null;   // media_id de WhatsApp si existiera

    if (message.type === 'text') {
      userText = message.text?.body || '';
    } else if (message.type === 'image') {
      mediaType = 'image';
      mediaId = message.image?.id || null;
      mediaUrl = message.image?.link || message.image?.url || null;
      userText = message.image?.caption || '';
    } else if (message.type === 'video') {
      mediaType = 'video';
      mediaId = message.video?.id || null;
      mediaUrl = message.video?.link || message.video?.url || null;
      userText = message.video?.caption || '';
    }

    logger.debug({ from: fromNumber, mediaType, hasMediaId: !!mediaId, hasMediaUrl: !!mediaUrl }, 'Incoming WhatsApp message');

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

    const captionBase = aiPlan.caption || userText || '';
    const hashtags = (aiPlan.hashtags || []).join(' ');
    const finalCaption = [captionBase, hashtags].filter(Boolean).join('\n\n');

    // Hosting temporal en Cloudinary
    let uploaded = null;
    let publishMediaUrl = null;

    if (mediaType === 'image' || mediaType === 'video') {
      // Prioridad: media_id (WhatsApp) -> URL temporal -> descarga binaria -> uploadBuffer
      if (mediaId) {
        try {
          const meta = await getMediaMeta(mediaId); // { url, mime_type, ... }
          if (meta?.url) {
            const bin = await downloadMediaBuffer(meta.url);
            uploaded = await uploadBuffer({ buffer: bin, resourceType: mediaType });
            publishMediaUrl = uploaded.secureUrl;
          }
        } catch (e) {
          logger.error({ err: e }, 'Error obteniendo/subiendo media de WhatsApp');
        }
      }

      // Fallback: URL pública
      if (!publishMediaUrl && mediaUrl && /^https?:\/\//i.test(mediaUrl)) {
        try {
          uploaded = await uploadFromUrl({ url: mediaUrl, resourceType: mediaType });
          publishMediaUrl = uploaded.secureUrl;
        } catch (e) {
          logger.error({ err: e }, 'Error subiendo media por URL pública a Cloudinary');
        }
      }
    }

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
            videoUrl: mediaType === 'video' ? publishMediaUrl : undefined,
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

    // Limpieza: borrar el media temporal si hubo al menos una publicación exitosa
    const anySuccess = results.some(r => !r.error);
    if (anySuccess && uploaded?.publicId) {
      await deleteMedia(uploaded.publicId, mediaType === 'video' ? 'video' : 'image');
    }

    // Respuesta por WhatsApp
    if (results.length === 0) {
      await sendWhatsAppMessage({ waNumberId, to: fromNumber, text: 'No se detectaron plataformas válidas para publicar.' });
      return;
    }

    const lines = results.map(r =>
      r.error ? `❌ ${r.platform}: ${r.error}` : `✅ ${r.platform}: ${r.url || r.id}`
    );
    const response = `Resumen de publicaciones:\n${lines.join('\n')}`;
    await sendWhatsAppMessage({ waNumberId, to: fromNumber, text: response });
  } catch (err) {
    logger.error({ err }, 'Error en handleIncomingWhatsAppMessage');
    try {
      const to = from || message?.from;
      if (to && waNumberId) {
        await sendWhatsAppMessage({ waNumberId, to, text: 'Ocurrió un error procesando tu solicitud. Inténtalo más tarde.' });
      }
    } catch {}
  }
}