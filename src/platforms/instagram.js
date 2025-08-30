import Instagram from 'instagram-web-api';
import FileCookieStore from 'tough-cookie-filestore2';
import fs from 'fs';
import config from '../config.js';
import { logger } from '../logger.js';

function getInstagramWebClient() {
  const { username, password, cookieFile } = config.instagram;
  if (!username || !password) {
    throw new Error('INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD son requeridos');
  }
  // Asegurar archivo de cookies
  if (cookieFile && !fs.existsSync(cookieFile)) {
    try { fs.writeFileSync(cookieFile, '{}', { encoding: 'utf8' }); } catch {}
  }
  const cookieStore = cookieFile ? new FileCookieStore(cookieFile) : undefined;
  const client = new Instagram({ username, password, cookieStore });
  return client;
}

// Publicar en Instagram usando instagram-web-api
async function postToInstagram({ caption, imageUrl }) {
  logger.info({ 
    hasCaption: !!caption,
    hasImageUrl: !!imageUrl,
    username: config.instagram.username,
    hasPassword: !!config.instagram.password
  }, 'postToInstagram: instagram-web-api');

  if (!imageUrl) {
    throw new Error('Instagram requiere imageUrl (solo soporta imágenes)');
  }

  try {
    const client = getInstagramWebClient();
    logger.info('Iniciando login en Instagram...');
    
    await client.login();
    logger.info('Login exitoso en Instagram');
    
    logger.info({ imageUrl, caption }, 'Subiendo foto a Instagram...');
    const { media } = await client.uploadPhoto({ 
      photo: imageUrl, 
      caption: caption || '', 
      post: 'feed' 
    });
    
    const code = media?.code;
    logger.info({ mediaId: media?.id, code }, 'Foto subida exitosamente a Instagram');
    
    return { 
      platform: 'instagram', 
      id: media?.id || code, 
      url: code ? `https://www.instagram.com/p/${code}/` : undefined 
    };
  } catch (err) {
    logger.error({ 
      err: err.message,
      stack: err.stack,
      response: err?.response?.data 
    }, 'Error en postToInstagram');
    
    throw new Error(err.message || 'Error publicando en Instagram');
  }
}

export { postToInstagram };