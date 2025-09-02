import FB from 'fb';
import config from '../config.js';
import { logger } from '../logger.js';
import axios from 'axios';

// Intenta detectar si el error corresponde a token expirado/invalidado
function isExpiredTokenError(err) {
  try {
    const respErr = err?.response?.error || err?.response?.data?.error || err?.error || {};
    const code = respErr.code ?? err?.code;
    const subcode = respErr.error_subcode ?? err?.error_subcode;
    const message = respErr.message || err?.message || '';
    if (code === 190 && (subcode === 463 || subcode === 460)) return true;
    if (typeof message === 'string' && /code\"?\s*:?\s*190/i.test(message) && /expired|has\s+expired|session/i.test(message)) return true;
  } catch (_) {}
  return false;
}

// Intercambia un user access token por uno de larga duración
async function exchangeForLongLivedUserToken({ appId, appSecret, userAccessToken }) {
  const url = 'https://graph.facebook.com/v19.0/oauth/access_token';
  const params = {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: userAccessToken,
  };
  const { data } = await axios.get(url, { params });
  return data?.access_token;
}

// Obtiene el Page Access Token a partir de un User Access Token
async function getPageAccessTokenFromUserToken({ pageId, userAccessToken }) {
  const url = 'https://graph.facebook.com/v19.0/me/accounts';
  const { data } = await axios.get(url, { params: { access_token: userAccessToken } });
  const pages = data?.data || [];
  const page = pages.find(p => String(p.id) === String(pageId));
  return page?.access_token || null;
}

// Refresca el Page Access Token si es posible, retornando el nuevo token o null
async function refreshPageAccessTokenIfPossible() {
  const { appId, appSecret, userAccessToken, pageId } = config.facebook;
  if (!appId || !appSecret || !userAccessToken || !pageId) return null;
  try {
    logger.warn('Intentando refrescar token de Facebook (user long-lived -> page token)');
    const longLivedUserToken = await exchangeForLongLivedUserToken({ appId, appSecret, userAccessToken });
    const pageToken = await getPageAccessTokenFromUserToken({ pageId, userAccessToken: longLivedUserToken || userAccessToken });
    if (pageToken) {
      logger.info('Token de página de Facebook refrescado correctamente');
      // Actualizamos en memoria para siguientes publicaciones
      config.facebook.accessToken = pageToken;
      return pageToken;
    }
  } catch (e) {
    logger.error({ err: e?.message, data: e?.response?.data }, 'Fallo refrescando token de Facebook');
  }
  return null;
}

// Publicar en Facebook usando Graph API
async function postToFacebook({ message, imageUrl, videoUrl, link }) {
  const pageId = config.facebook.pageId;
  const initialAccessToken = config.facebook.accessToken;

  logger.info({ 
    hasMessage: !!message,
    hasImageUrl: !!imageUrl,
    hasVideoUrl: !!videoUrl,
    hasLink: !!link,
    pageId,
    hasAccessToken: !!initialAccessToken
  }, 'postToFacebook: Graph API');

  if (!pageId) {
    throw new Error('FACEBOOK_PAGE_ID es requerido');
  }
  if (!initialAccessToken) {
    throw new Error('META_ACCESS_TOKEN es requerido');
  }

  async function publish(accessToken) {
    const fb = new FB.Facebook({ accessToken });

    let result;

    if (imageUrl) {
      logger.info({ imageUrl }, 'Publicando imagen en Facebook');
      const photoResult = await fb.api(`${pageId}/photos`, 'POST', {
        url: imageUrl,
        caption: message || '',
      });
      result = { platform: 'facebook', id: photoResult.id, url: `https://facebook.com/${photoResult.id}` };
    } else if (videoUrl) {
      logger.info({ videoUrl }, 'Publicando video en Facebook');
      const videoResult = await fb.api(`${pageId}/videos`, 'POST', {
        file_url: videoUrl,
        description: message || '',
      });
      result = { platform: 'facebook', id: videoResult.id, url: `https://facebook.com/${videoResult.id}` };
    } else {
      logger.info('Publicando texto en Facebook');
      const postData = { message: message || '' };
      if (link) postData.link = link;
      const postResult = await fb.api(`${pageId}/feed`, 'POST', postData);
      result = { platform: 'facebook', id: postResult.id, url: `https://facebook.com/${postResult.id}` };
    }

    return result;
  }

  try {
    const res = await publish(initialAccessToken);
    logger.info({ result: res }, 'Publicado exitosamente en Facebook');
    return res;
  } catch (err) {
    logger.error({ 
      err: err.message,
      stack: err.stack,
      response: err?.response?.data || err?.response
    }, 'Error en postToFacebook (primer intento)');

    // Si el token expiró, intentamos refrescar y reintentar automáticamente
    if (isExpiredTokenError(err)) {
      const newToken = await refreshPageAccessTokenIfPossible();
      if (newToken) {
        try {
          const retryRes = await publish(newToken);
          logger.info({ result: retryRes }, 'Publicado exitosamente en Facebook tras refrescar token');
          return retryRes;
        } catch (err2) {
          logger.error({ err: err2.message, data: err2?.response?.data }, 'Fallo al publicar en Facebook incluso tras refrescar token');
          throw new Error(err2.message || 'Error publicando en Facebook (reintento)');
        }
      }
    }

    throw new Error(err.message || 'Error publicando en Facebook');
  }
}

export { postToFacebook };