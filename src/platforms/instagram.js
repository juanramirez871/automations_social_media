import { IgApiClient } from 'instagram-api-web-node';
import fs from 'fs';
import config from '../config.js';
import { logger } from '../logger.js';

let igClient = null;

function getInstagramClient() {
  if (!igClient) {
    igClient = new IgApiClient();
  }
  return igClient;
}

// Guardar estado de sesión
function saveSession(data) {
  try {
    const cookie = JSON.stringify(data);
    fs.writeFileSync(config.instagram.cookieFile, cookie, 'utf8');
    logger.debug('Sesión de Instagram guardada');
  } catch (err) {
    logger.error({ err }, 'Error guardando sesión de Instagram');
  }
}

// Cargar estado de sesión
function loadSession() {
  try {
    if (fs.existsSync(config.instagram.cookieFile)) {
      const cookie = fs.readFileSync(config.instagram.cookieFile, 'utf8');
      return JSON.parse(cookie);
    }
  } catch (err) {
    logger.error({ err }, 'Error cargando sesión de Instagram');
  }
  return null;
}

// Publicar en Instagram usando instagram-api-web-node
async function postToInstagram({ caption, imageUrl, videoUrl }) {
  logger.info({ 
    hasCaption: !!caption,
    hasImageUrl: !!imageUrl,
    hasVideoUrl: !!videoUrl,
    username: config.instagram.username
  }, 'postToInstagram: instagram-api-web-node');

  if (!imageUrl && !videoUrl) {
    throw new Error('Instagram requiere imageUrl o videoUrl');
  }

  try {
    const instagram = getInstagramClient();
    
    // Configurar callback para guardar sesión después de cada request
    instagram.request.end$.subscribe(async () => {
      try {
        const serialized = await instagram.state.serialize();
        saveSession(serialized);
      } catch (err) {
        logger.error({ err }, 'Error serializando estado de Instagram');
      }
    });

    // Cargar sesión existente o hacer login
    const savedSession = loadSession();
    if (savedSession) {
      logger.info('Cargando sesión existente de Instagram');
      try {
        await instagram.state.deserialize(savedSession);
        logger.info('Sesión de Instagram restaurada');
      } catch (err) {
        logger.warn({ err }, 'Error restaurando sesión, haciendo login nuevo');
        await doLogin(instagram);
      }
    } else {
      await doLogin(instagram);
    }

    // Publicar contenido
    let result;
    if (imageUrl) {
      logger.info({ imageUrl }, 'Subiendo imagen a Instagram');
      // Descargar imagen y subirla
      const response = await fetch(imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      result = await instagram.ig.publish.photo({
        file: buffer,
        caption: caption || ''
      });
      
      logger.info({ mediaId: result.media?.id }, 'Imagen publicada en Instagram');
    } else if (videoUrl) {
      logger.info({ videoUrl }, 'Subiendo video a Instagram');
      // Descargar video y subirlo
      const response = await fetch(videoUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      result = await instagram.ig.publish.video({
        video: buffer,
        caption: caption || ''
      });
      
      logger.info({ mediaId: result.media?.id }, 'Video publicado en Instagram');
    }

    const mediaId = result?.media?.id;
    const code = result?.media?.code;
    
    return { 
      platform: 'instagram', 
      id: mediaId || code, 
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

// Función auxiliar para hacer login
async function doLogin(instagram) {
  const { username, password } = config.instagram;
  if (!username || !password) {
    throw new Error('INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD son requeridos');
  }

  logger.info({ username }, 'Iniciando login en Instagram');
  
  await instagram.state.generateDevice(username);
  await instagram.ig.account.login(username, password);
  
  logger.info('Login exitoso en Instagram');
}

export { postToInstagram };