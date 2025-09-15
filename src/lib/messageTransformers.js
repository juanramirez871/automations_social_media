/**
 * Transformadores de mensajes para convertir datos de BD a formato UI
 */

/**
 * Transforma mensajes de la base de datos al formato requerido por la UI
 * @param {Array} rawMessages - Mensajes crudos de la BD
 * @returns {Array} Mensajes transformados para UI
 */
export function transformMessagesFromDB(rawMessages) {
  let hasPublishResult = false;

  const transformedMessages = rawMessages
    .map(r => {
      const rType = r.type;

      // Mensajes internos que no se renderizan
      if (rType === 'internal-targets' || rType === 'internal-schedule') {
        return null;
      }

      if (rType === 'internal-publish-result') {
        hasPublishResult = true;
        return null;
      }

      // Widgets de autenticación
      if (rType === 'widget-auth-gate') {
        return { id: r.id, role: 'assistant', type: 'widget-auth-gate' };
      }

      if (rType === 'widget-auth-form') {
        return { id: r.id, role: 'assistant', type: 'widget-auth-form' };
      }

      // Widgets de Instagram
      if (
        rType === 'widget-instagram-credentials' ||
        rType === 'widget-instagram-auth'
      ) {
        return { id: r.id, role: 'assistant', type: 'widget-instagram-auth' };
      }

      if (rType === 'widget-instagram-configured') {
        const name = r?.meta?.name || null;
        const id = r?.meta?.id || null;
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-instagram-configured',
          name,
          igId: id,
        };
      }

      if (rType === 'widget-instagram-connected') {
        const username = r?.meta?.username || r?.meta?.name || null;
        const igId = r?.meta?.igId || r?.meta?.id || null;
        const expiresAt = r?.meta?.expiresAt || null;
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-instagram-connected',
          username,
          igId,
          expiresAt,
        };
      }

      // Widgets de Facebook
      if (rType === 'widget-facebook-auth') {
        return { id: r.id, role: 'assistant', type: 'widget-facebook-auth' };
      }

      if (rType === 'widget-facebook-connected') {
        const fbId = r?.meta?.fbId || null;
        const name = r?.meta?.name || null;
        const scopes = r?.meta?.scopes || null;
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-facebook-connected',
          fbId,
          name,
          scopes,
        };
      }

      // Widgets de YouTube
      if (rType === 'widget-youtube-auth') {
        return { id: r.id, role: 'assistant', type: 'widget-youtube-auth' };
      }

      if (rType === 'widget-youtube-connected') {
        const channelId = r?.meta?.channelId || null;
        const channelTitle = r?.meta?.channelTitle || null;
        const grantedScopes = r?.meta?.grantedScopes || null;
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-youtube-connected',
          channelId,
          channelTitle,
          grantedScopes,
        };
      }

      // Widgets de TikTok
      if (rType === 'widget-tiktok-auth') {
        return { id: r.id, role: 'assistant', type: 'widget-tiktok-auth' };
      }

      if (rType === 'widget-tiktok-connected') {
        const displayName = r?.meta?.displayName || null;
        const username = r?.meta?.username || null;
        const avatarUrl = r?.meta?.avatarUrl || null;
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-tiktok-connected',
          displayName,
          username,
          avatarUrl,
        };
      }

      // Widgets de control
      if (rType === 'widget-platforms') {
        return { id: r.id, role: 'assistant', type: 'widget-platforms' };
      }

      if (rType === 'widget-await-media') {
        const targets = r?.meta?.targets || [];
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-await-media',
          meta: { targets },
        };
      }

      if (rType === 'widget-caption-suggest') {
        const caption = r?.meta?.caption || '';
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-caption-suggest',
          meta: { caption },
        };
      }

      if (rType === 'widget-schedule') {
        const defaultValue = r?.meta?.defaultValue || null;
        return {
          id: r.id,
          role: 'assistant',
          type: 'widget-schedule',
          meta: { defaultValue },
        };
      }

      // Mensajes de texto normales
      if (rType === 'text' || !rType) {
        const attachments = r.attachments || [];
        if (r.role === 'user') {
          return { id: r.id, role: 'user', text: r.content, attachments };
        } else {
          return { id: r.id, role: 'assistant', content: r.content };
        }
      }

      // Mensajes con media
      if (rType === 'text+media') {
        const attachments = r.attachments || [];
        return { id: r.id, role: 'user', text: r.content, attachments };
      }

      // Fallback para tipos desconocidos
      return { id: r.id, role: r.role, content: r.content, type: rType };
    })
    .filter(Boolean); // Remover nulls

  return { messages: transformedMessages, hasPublishResult };
}
