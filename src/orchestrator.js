const { planPost } = require('./openai');
const { postToFacebook, postToInstagram } = require('./platforms/facebook');
const { postToX } = require('./platforms/x');
const { sendWhatsAppMessage, getMediaMeta, downloadMediaBuffer } = require('./whatsapp_client');
const { uploadFromUrl, uploadBuffer, deleteMedia } = require('./media_store');
const config = require('./config');

/*
  Se espera que el usuario envíe por WhatsApp:
  - Un mensaje de texto indicando: redes destino (facebook, instagram, x) y una breve descripción/prompt
  - Opcionalmente, una imagen o video. Podemos recibir:
    a) una URL pública en el texto, o
    b) un media_id nativo de WhatsApp (desc
  - Eventualmente, una imagen o video. En esta primera versión, asumimos que el usuario nos envía una URL pública del medio en el texto (p. ej. https://...)

  Mejoras futuras: descargar el medio de WhatsApp y subirlo a un storage público (S3, Cloudinary) para obtener URL pública y luego publicar en redes.
*/
async function handleIncomingWhatsAppMessage({ message, from, waNumberId }) {
  try {
    const fromNumber = message.from; // número de teléfono del usuario

    let userText = '';
    let mediaType = null;
    let mediaUrl = null;

    if (message.type === 'text') {
      userText = message.text?.body || '';
    } else if (message.type === 'image') {
      mediaType = 'image';
      mediaUrl = message.image?.link || message.image?.url || null; // para WhatsApp Cloud, suele venir como id; necesitaríamos descargar con Graph API
      userText = message.caption || '';
    } else if (message.type === 'video') {
      mediaType = 'video';
      mediaUrl = message.video?.link || message.video?.url || null;
      userText = message.caption || '';
    }

    // Extraer plataformas explícitas si el usuario las menciona, p. ej. "Subir a facebook, instagram"
    const explicitPlatforms = [];
    const textLower = (userText || '').toLowerCase();
    if (textLower.includes('facebook')) explicitPlatforms.push('facebook');
    if (textLower.includes('instagram')) explicitPlatforms.push('instagram');
    if (textLower.includes('twitter') || textLower.includes('x')) explicitPlatforms.push('x');

    // Pedir a OpenAI que planifique (si no hay explícitas, decide; si hay, respétalas)
    const aiPlan = await planPost({ userPrompt: userText, mediaType });
    let platforms = explicitPlatforms.length ? explicitPlatforms : aiPlan.platforms;
    // Normalizar y deduplicar
    platforms = Array.from(new Set((platforms || []).map(p => String(p).toLowerCase()))).filter(p => ['facebook','instagram','x'].includes(p));

    const captionBase = aiPlan.caption || userText || '';
    const hashtags = (aiPlan.hashtags || []).join(' ');
    const finalCaption = [captionBase, hashtags].filter(Boolean).join('\n\n');

    // Si viene media URL pública, la subimos temporalmente a Cloudinary y usamos esa URL para publicar.
    let uploaded = null;
    let publishMediaUrl = null;
    if ((mediaType === 'image' || mediaType === 'video') && mediaUrl && /^https?:\/\//i.test(mediaUrl)) {
      try {
        uploaded = await uploadFromUrl({ url: mediaUrl, resourceType: mediaType });
        publishMediaUrl = uploaded.secureUrl;
      } catch (e) {
        // Si falla el hosting, continuamos publicando lo que se pueda (texto)
        console.error('Error subiendo media a Cloudinary:', e.message);
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
          // Instagram requiere media; si no hay, saltamos
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

    // Si hubo al menos una publicación exitosa y subimos a Cloudinary, borramos el media
    const anySuccess = results.some(r => !r.error);
    if (anySuccess && uploaded?.publicId) {
      await deleteMedia(uploaded.publicId, mediaType === 'video' ? 'video' : 'image');
    }

    // Responder por WhatsApp con el resultado
    if (results.length === 0) {
      await sendWhatsAppMessage({ waNumberId, to: fromNumber, text: 'No se pudo publicar en ninguna plataforma. Revisa tu configuración.' });
    } else {
      const ok = results.filter(r => !r.error);
      const ko = results.filter(r => r.error);
      const lines = [];
      if (ok.length) {
        lines.push('Publicaciones exitosas:\n' + ok.map(r => `- ${r.platform}: ${r.url || r.id || 'sin URL'}`).join('\n'));
      }
      if (ko.length) {
        lines.push('Con errores:\n' + ko.map(r => `- ${r.platform}: ${r.error}`).join('\n'));
      }
      await sendWhatsAppMessage({ waNumberId, to: fromNumber, text: lines.join('\n\n') });
    }
  } catch (err) {
    console.error('Orchestrator error:', err);
  }
}

module.exports = { handleIncomingWhatsAppMessage };