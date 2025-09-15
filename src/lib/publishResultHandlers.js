import { newId } from './publishFlowUtils';
import { saveMessageToDB } from './databaseUtils';

/**
 * Mapeo de nombres de plataformas
 */
const PLATFORM_NAMES = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

/**
 * Genera mensaje de confirmación basado en resultados de publicación
 * @param {Array} results - Resultados de publicación por plataforma
 * @returns {string} Mensaje de confirmación
 */
export function generatePublishConfirmMessage(results) {
  if (!results || results.length === 0) {
    return 'No recibí resultados de publicación del servidor.';
  }

  const successResults = results.filter(r => r && r.success);
  const errorResults = results.filter(r => r && !r.success);

  if (errorResults.length === 0) {
    // Todos exitosos
    const platformsStr = successResults
      .map(r => PLATFORM_NAMES[r.platform] || r.platform)
      .join(', ')
      .replace(/,([^,]*)$/, ' y$1');

    let message = `¡Perfecto! Tu contenido se publicó exitosamente en ${platformsStr}.`;

    const links = successResults
      .filter(r => r.url)
      .map(r => `${PLATFORM_NAMES[r.platform] || r.platform}: ${r.url}`);

    if (links.length) {
      message += ` Puedes verlo aquí: ${links.join(' | ')}`;
    }

    return message;
  }

  if (successResults.length > 0) {
    // Parcialmente exitoso
    const okStr = successResults
      .map(r => PLATFORM_NAMES[r.platform] || r.platform)
      .join(', ')
      .replace(/,([^,]*)$/, ' y$1');

    const errStr = errorResults
      .map(
        r =>
          `${PLATFORM_NAMES[r.platform] || r.platform} (${r?.error || 'Error desconocido'})`
      )
      .join('; ');

    let message = `Se publicó parcialmente. Éxitos: ${okStr}.`;

    const links = successResults
      .filter(r => r.url)
      .map(r => `${PLATFORM_NAMES[r.platform] || r.platform}: ${r.url}`);

    if (links.length) {
      message += ` Links: ${links.join(' | ')}.`;
    }

    message += ` Errores: ${errStr}.`;
    return message;
  }

  // Todos fallaron
  const errStr = errorResults
    .map(
      r =>
        `${PLATFORM_NAMES[r.platform] || r.platform} (${r?.error || 'Error desconocido'})`
    )
    .join('; ');

  return `Hubo un problema al publicar: ${errStr || 'Error desconocido'}`;
}

/**
 * Crea mensajes de confirmación para publicación exitosa
 * @param {object} result - Resultado de la operación
 * @returns {object} Mensajes de confirmación y siguiente post
 */
export function createPublishConfirmMessages(result) {
  const publishResult = result.publishResult;
  const results = Array.isArray(publishResult?.results)
    ? publishResult.results
    : [];
  const confirmMessage = generatePublishConfirmMessage(results);

  const confirm = {
    id: newId('publish-confirm'),
    role: 'assistant',
    type: 'text',
    content: confirmMessage,
  };

  const nextPostMessage = {
    id: newId('next-post-offer'),
    role: 'assistant',
    type: 'text',
    content:
      '¿Te gustaría subir otro post? Solo dime "sí" o "publicar" para empezar de nuevo.',
  };

  return { confirm, nextPostMessage, results };
}

/**
 * Crea mensajes de confirmación para programación exitosa
 * @param {object} result - Resultado de la programación
 * @returns {object} Mensajes de confirmación y siguiente post
 */
export function createScheduleConfirmMessages(result) {
  const dateValue = result.scheduledDate || result;
  const when = new Date(dateValue);
  const pretty = isNaN(when.getTime()) ? dateValue : when.toLocaleString();

  const confirm = {
    id: newId('schedule-confirm'),
    role: 'assistant',
    type: 'text',
    content: `Perfecto. Programé la subida para ${pretty}.`,
  };

  const nextPostMessage = {
    id: newId('next-post-offer-schedule'),
    role: 'assistant',
    type: 'text',
    content:
      '¿Te gustaría subir otro post? Solo dime "sí" o "publicar" para empezar de nuevo.',
  };

  return { confirm, nextPostMessage };
}

/**
 * Guarda mensajes de resultado en la base de datos
 * @param {string} userId - ID del usuario
 * @param {object} result - Resultado de la operación
 * @param {object} messages - Mensajes a guardar
 */
export async function savePublishResultToDB(userId, result, messages) {
  if (!userId) return;

  try {
    if (result.publishResult) {
      // Guardar resultado de publicación
      await saveMessageToDB({
        userId,
        role: 'assistant',
        content: '',
        attachments: null,
        type: 'internal-publish-result',
        meta: {
          scheduledDate: result.scheduledDate,
          publishResult: result.publishResult,
          platforms:
            messages.results?.map(r => ({
              platform: r.platform,
              success: !!r.success,
              id: r.id || null,
              url: r.url || null,
              error: r.error || null,
            })) || [],
        },
      });
    } else {
      // Guardar resultado de programación
      await saveMessageToDB({
        userId,
        role: 'assistant',
        content: '',
        attachments: null,
        type: 'internal-schedule',
        meta: { value: result },
      });
    }

    // Guardar mensajes de confirmación
    await saveMessageToDB({
      userId,
      role: 'assistant',
      content: messages.confirm.content,
      attachments: null,
      type: 'text',
    });

    await saveMessageToDB({
      userId,
      role: 'assistant',
      content: messages.nextPostMessage.content,
      attachments: null,
      type: 'text',
    });
  } catch (error) {
    console.error('Error saving publish result to DB:', error);
  }
}
