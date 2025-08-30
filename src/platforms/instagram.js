import { IgApiClient } from 'instagram-private-api';
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

// Publicar en Instagram usando instagram-private-api
async function postToInstagram({ caption, imageUrl, videoUrl }) {
  logger.info({ 
    hasCaption: !!caption,
    hasImageUrl: !!imageUrl,
    hasVideoUrl: !!videoUrl,
    username: config.instagram.username
  }, 'postToInstagram: instagram-private-api');

  if (!imageUrl && !videoUrl) {
    throw new Error('Instagram requiere imageUrl o videoUrl');
  }

  try {
    const ig = getInstagramClient();
    
    // Cargar sesión existente o hacer login
    const savedSession = loadSession();
    if (savedSession) {
      logger.info('Cargando sesión existente de Instagram');
      try {
        await ig.state.deserialize(savedSession);
        logger.info('Sesión de Instagram restaurada');
      } catch (err) {
        logger.warn({ err }, 'Error restaurando sesión, haciendo login nuevo');
        await doLogin(ig);
      }
    } else {
      await doLogin(ig);
    }

    // Publicar contenido
    let result;
    if (imageUrl) {
      logger.info({ imageUrl }, 'Subiendo imagen a Instagram');
      // Descargar imagen
      const response = await fetch(imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Publicar imagen
      result = await ig.publish.photo({
        file: buffer,
        caption: caption || ''
      });
      
      logger.info({ mediaId: result.media?.id }, 'Imagen publicada en Instagram');
    } else if (videoUrl) {
      logger.info({ videoUrl }, 'Subiendo video a Instagram');
      // Descargar video
      const response = await fetch(videoUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Publicar video
      result = await ig.publish.video({
        video: buffer,
        caption: caption || ''
      });
      
      logger.info({ mediaId: result.media?.id }, 'Video publicado en Instagram');
    }

    // Guardar sesión después de publicar
    try {
      const serialized = await ig.state.serialize();
      saveSession(serialized);
    } catch (err) {
      logger.error({ err }, 'Error guardando sesión después de publicar');
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
async function doLogin(ig) {
  const { username, password } = config.instagram;
  if (!username || !password) {
    throw new Error('INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD son requeridos');
  }

  logger.info({ username }, 'Iniciando login en Instagram');
  
  try {
    // Generar dispositivo basado en el username
    ig.state.generateDevice(username);
    
    // Ejecutar flujo pre-login (recomendado)
    await ig.simulate.preLoginFlow();
    
    // Hacer login
    const loggedInUser = await ig.account.login(username, password);
    
    // Ejecutar flujo post-login (opcional pero recomendado)
    process.nextTick(async () => {
      try {
        await ig.simulate.postLoginFlow();
      } catch (err) {
        logger.warn({ err }, 'Error en post-login flow');
      }
    });
    
    logger.info({ userId: loggedInUser.pk, username: loggedInUser.username }, 'Login exitoso en Instagram');
    
    // Guardar sesión
    const serialized = await ig.state.serialize();
    saveSession(serialized);
    
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Error en login de Instagram');
    throw err;
  }
}

export { postToInstagram };