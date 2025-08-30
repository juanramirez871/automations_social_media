import { planPost } from './ai.js';
import { postToFacebook } from './platforms/facebook.js';
import { postToInstagram } from './platforms/instagram.js';
import { postToX } from './platforms/x.js';
import { sendBaileysMessage } from './whatsapp_baileys.js';
import { uploadFromUrl, uploadBuffer, deleteMedia } from './media_store.js';
import { logger } from './logger.js';
import config from './config.js';

// Sesiones en memoria por usuario (JID/numero) para flujo en 3 pasos
// step: 'await_platforms' -> esperando que el usuario diga las redes
// step: 'await_description' -> esperando la descripción/brief
const pendingSessions = new Map(); // key = fromNumber, value = { mediaType, publishMediaUrl, uploaded, createdAt, step, selectedPlatforms }

// Utilidad: parsear plataformas desde texto del usuario
function parsePlatforms(text = '') {
  const t = String(text || '').toLowerCase();
  const out = new Set();
  if (/\binstagram\b|\big\b|\binsta\b/.test(t)) out.add('instagram');
  if (/\bfacebook\b|\bfb\b|\bface\b/.test(t)) out.add('facebook');
  if (/\btwitter\b|\bx\b/.test(t)) out.add('x');
  return Array.from(out);
}

/*
  Nueva lógica de flujo (3 pasos):
  1) Usuario envía imagen o video -> subimos a Cloudinary, guardamos en sesión (step=await_platforms) y pedimos plataformas.
  2) Usuario envía texto con plataformas -> guardamos selectedPlatforms, avanzamos a step=await_description y pedimos la descripción.
  3) Usuario envía la descripción -> generamos caption/hashtags con IA (ignorando plataformas), publicamos en selectedPlatforms y limpiamos sesión.
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

    // PASO 1: Llega media (imagen/video) -> subir, guardar sesión y pedir plataformas
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
          step: 'await_platforms',
          selectedPlatforms: [],
        });
        const replaceNote = hadPrev ? '\n(Nueva media recibida: se reemplazó la anterior.)' : '';
        try {
          await sendBaileysMessage({
            to: fromNumber,
            text: `✅ Media recibida exitosamente.${replaceNote}\n\nPaso 1/2: dime a qué redes quieres publicar: instagram, facebook y/o x.\nEjemplos: "instagram" o "instagram, facebook".`,
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

      logger.info('handleIncomingWhatsAppMessage: fin (esperando plataformas)');
      return; // No publicamos aún, esperamos plataformas
    }

    // PASO 2 y 3: Llega texto
    if (message.type === 'text') {
      const session = pendingSessions.get(fromNumber);
      if (!session) {
        // No hay media pendiente -> pedimos que envíe primero imagen/video
        try {
          await sendBaileysMessage({
            to: fromNumber,
            text: '¡Hola! 👋 Soy tu asistente para automatizar publicaciones en redes sociales ✨\n\nPuedo publicar en Instagram, Facebook y X a partir de lo que envíes por WhatsApp 📲\n\nPara empezar:\n1) Envía una foto 📸 o un video 🎬\n2) Luego te pediré las plataformas y la descripción para generar un post profesional con hashtags.\n\nEjemplo de uso:\n- Envías una foto\n- Respondes: "instagram, facebook"\n- Luego: "Lanzamos nuestro nuevo café de origen único, notas a chocolate..."',
          });
        } catch (e) { logger.error({ err: e }, 'Error enviando instrucción inicial'); }
        logger.info('handleIncomingWhatsAppMessage: fin (sin sesión de media)');
        return;
      }

      const { mediaType: sessMediaType, publishMediaUrl, uploaded } = session;
      const promptText = userText || '';

      // Control por pasos
      if (session.step === 'await_platforms') {
        const plats = parsePlatforms(promptText).filter(p => ['facebook','instagram','x'].includes(p));
        if (!plats.length) {
          try {
            await sendBaileysMessage({
              to: fromNumber,
              text: 'Por favor, indícame solo las plataformas: instagram, facebook y/o x.\nEjemplo: "instagram, facebook"',
            });
          } catch {}
          logger.info('Aún esperando plataformas válidas');
          return;
        }
        // Guardar plataformas y pedir descripción
        session.selectedPlatforms = plats;
        session.step = 'await_description';
        pendingSessions.set(fromNumber, session);
        try {
          await sendBaileysMessage({
            to: fromNumber,
            text: '✨ Genial. Paso 2/2: envíame una breve descripción del post (sin mencionar plataformas).\nEjemplo: "Lanzamos nuestro nuevo café de origen único, notas a chocolate..."\n\nYo me encargo de crear una descripción profesional y 8-15 hashtags relevantes.',
          });
        } catch {}
        logger.info({ selectedPlatforms: plats }, 'Plataformas recibidas, esperando descripción');
        return;
      }

      if (session.step === 'await_description') {
        // Generar plan con OpenAI usando SOLO la descripción y el tipo de media almacenado
        const aiPlan = await planPost({ userPrompt: promptText, mediaType: sessMediaType });

        // Usar exclusivamente las plataformas elegidas por el usuario en el paso anterior
        let platforms = Array.from(new Set((session.selectedPlatforms || []).map(p => String(p).toLowerCase()))).filter(p => ['facebook','instagram','x'].includes(p));
        // Fallback si por alguna razón no hay plataformas almacenadas
        if (!platforms.length) {
          platforms = Array.from(new Set((aiPlan.platforms || []).map(p => String(p).toLowerCase()))).filter(p => ['facebook','instagram','x'].includes(p));
        }
        logger.info({ platforms, mediaType: sessMediaType, hasPublishMediaUrl: !!publishMediaUrl }, 'Plataformas seleccionadas');

        const captionBase = aiPlan.caption || '';
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
            let errMsg = e?.message || 'Error';
            if (p === 'facebook') {
              const msg = String(errMsg || '').toLowerCase();
              if (msg.includes('code 190') || msg.includes('oauth') || msg.includes('expired') || msg.includes('access token')) {
                errMsg = 'No fue posible publicar en Facebook por un problema temporal de sesión. Reintentamos automáticamente.';
              }
            }
            results.push({ platform: p, error: errMsg });
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

      // Si por alguna razón la sesión no tiene step conocido, reiniciar al paso de plataformas
      session.step = 'await_platforms';
      pendingSessions.set(fromNumber, session);
      try {
        await sendBaileysMessage({ to: fromNumber, text: 'Vamos a organizarlo 😊\nPaso 1/2: dime las plataformas: instagram, facebook y/o x.' });
      } catch {}
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