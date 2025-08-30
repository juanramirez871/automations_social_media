import FB from 'fb';
import config from '../config.js';
import { logger } from '../logger.js';

// Publicar en Facebook usando Graph API
async function postToFacebook({ message, imageUrl, videoUrl, link }) {
  const pageId = config.facebook.pageId;
  const accessToken = config.facebook.accessToken;

  logger.info({ 
    hasMessage: !!message,
    hasImageUrl: !!imageUrl,
    hasVideoUrl: !!videoUrl,
    hasLink: !!link,
    pageId,
    hasAccessToken: !!accessToken
  }, 'postToFacebook: Graph API');

  if (!pageId) {
    throw new Error('FACEBOOK_PAGE_ID es requerido');
  }
  if (!accessToken) {
    throw new Error('META_ACCESS_TOKEN es requerido');
  }

  const fb = new FB.Facebook({ accessToken });

  try {
    let result;

    if (imageUrl) {
      logger.info({ imageUrl }, 'Publicando imagen en Facebook');
      // Subir y publicar imagen
      const photoResult = await fb.api(`${pageId}/photos`, 'POST', {
        url: imageUrl,
        caption: message || '',
      });
      
      result = {
        platform: 'facebook',
        id: photoResult.id,
        url: `https://facebook.com/${photoResult.id}`
      };
    } else if (videoUrl) {
      logger.info({ videoUrl }, 'Publicando video en Facebook');
      // Subir y publicar video
      const videoResult = await fb.api(`${pageId}/videos`, 'POST', {
        file_url: videoUrl,
        description: message || '',
      });
      
      result = {
        platform: 'facebook',
        id: videoResult.id,
        url: `https://facebook.com/${videoResult.id}`
      };
    } else {
      logger.info('Publicando texto en Facebook');
      // Publicar solo texto (con link opcional)
      const postData = { message: message || '' };
      if (link) postData.link = link;
      
      const postResult = await fb.api(`${pageId}/feed`, 'POST', postData);
      
      result = {
        platform: 'facebook',
        id: postResult.id,
        url: `https://facebook.com/${postResult.id}`
      };
    }

    logger.info({ result }, 'Publicado exitosamente en Facebook');
    return result;
  } catch (err) {
    logger.error({ 
      err: err.message,
      stack: err.stack,
      response: err?.response
    }, 'Error en postToFacebook');
    
    throw new Error(err.message || 'Error publicando en Facebook');
  }
}

export { postToFacebook };