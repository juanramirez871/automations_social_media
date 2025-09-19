/**
 * Utilidades para el flujo de publicación
 */

/**
 * Detecta si el usuario quiere iniciar un nuevo flujo de publicación
 * @param {string} text - Texto del usuario
 * @returns {boolean}
 */
export function detectNewPublishIntent(text) {
  const trimmed = text.trim();

  return (
    (/\b(publicar|postear|subir|programar)\b/i.test(trimmed) &&
      /(post|publicaci\u00F3n|video|reel|contenido)/i.test(trimmed)) ||
    /\b(sí|si|yes|ok|vale|dale|empezar|nuevo|otra|otro)\b/i.test(trimmed)
  );
}

/**
 * Detecta si el usuario quiere cancelar el flujo actual
 * @param {string} text - Texto del usuario
 * @returns {boolean}
 */
export function detectCancelIntent(text) {
  const lower = text.toLowerCase();
  const cancelPhrases = [
    'cancelar',
    'cancela',
    'cancel',
    'olvídalo',
    'olvidalo',
    'olvidalo',
    'ya no',
    'no quiero',
    'mejor no',
    'detente',
    'detener',
    'parar',
    'abort',
    'aborta',
    'anular',
    'no continuar',
    'no sigas',
    'stop',
  ];

  return cancelPhrases.some(p => lower.includes(p));
}

/**
 * Genera un ID único para mensajes
 * @param {string} prefix - Prefijo para el ID
 * @returns {string}
 */
export function newId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crea un mensaje de cancelación del flujo
 * @returns {object}
 */
export function createCancelMessage() {
  return {
    id: newId('cancel-publish'),
    role: 'assistant',
    type: 'text',
    content:
      'Entendido, cancelé el flujo de publicación. Cuando quieras, podemos volver a empezar.',
  };
}

/**
 * Crea un mensaje pidiendo media
 * @returns {object}
 */
export function createNeedMediaMessage() {
  return {
    id: newId('need-media'),
    role: 'assistant',
    type: 'text',
    content:
      'Necesito que adjuntes al menos una imagen o video para continuar.',
  };
}

/**
 * Crea un mensaje pidiendo descripción
 * @returns {object}
 */
export function createNeedDescriptionMessage() {
  return {
    id: newId('need-description'),
    role: 'assistant',
    type: 'text',
    content:
      'Perfecto. Ahora necesito que escribas una descripción para el post.',
  };
}
