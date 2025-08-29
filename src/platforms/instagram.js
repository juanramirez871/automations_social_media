import http from '../http.js';
import config from '../config.js';
import Instagram from 'instagram-web-api';
import FileCookieStore from 'tough-cookie-filestore2';
import fs from 'fs';

function getInstagramWebClient() {
  const { username, password, cookieFile } = config.instagram;
  if (!username || !password) {
    throw new Error('INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD son requeridos para provider=web');
  }
  // Asegurar archivo de cookies
  if (cookieFile && !fs.existsSync(cookieFile)) {
    try { fs.writeFileSync(cookieFile, '{}', { encoding: 'utf8' }); } catch {}
  }
  const cookieStore = cookieFile ? new FileCookieStore(cookieFile) : undefined;
  const client = new Instagram({ username, password, cookieStore });
  return client;
}

// Publicar en Instagram
async function postToInstagram({ caption, imageUrl, videoUrl }) {
  if (config.instagram.provider === 'web') {
    // Via instagram-web-api (no oficial): soporta uploadPhoto (imagen). Video no soportado aquí.
    if (!imageUrl) throw new Error('Instagram (web) requiere imageUrl. Video no soportado en este modo.');
    const client = getInstagramWebClient();
    await client.login();
    const { media } = await client.uploadPhoto({ photo: imageUrl, caption, post: 'feed' });
    const code = media?.code;
    return { platform: 'instagram', id: media?.id || code, url: code ? `https://www.instagram.com/p/${code}/` : undefined };
  }

  // Por defecto: Graph API (Business)
  const igId = config.instagram.businessAccountId;
  const accessToken = config.instagram.accessToken;

  try {
    let creationId;
    if (imageUrl) {
      // Crear media container
      const { data: createData } = await http.post(
        `https://graph.facebook.com/v19.0/${igId}/media`,
        {
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }
      );
      creationId = createData.id;
    } else if (videoUrl) {
      const { data: createData } = await http.post(
        `https://graph.facebook.com/v19.0/${igId}/media`,
        {
          video_url: videoUrl,
          caption,
          access_token: accessToken,
        }
      );
      creationId = createData.id;
    } else {
      throw new Error('Instagram requiere imageUrl o videoUrl');
    }

    // Publicar el container
    const { data: publishData } = await http.post(
      `https://graph.facebook.com/v19.0/${igId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      }
    );

    return { platform: 'instagram', id: publishData.id, url: `https://instagram.com/p/${publishData.id}` };
  } catch (err) {
    const error = err?.response?.data || err.message;
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

// Obtener posts recientes por username (solo provider web)
async function getInstagramPosts({ username, first = 12 }) {
  if (config.instagram.provider !== 'web') {
    throw new Error('getInstagramPosts solo está disponible con INSTAGRAM_PROVIDER=web');
  }
  const client = getInstagramWebClient();
  await client.login();
  const resp = await client.getPhotosByUsername({ username, first });
  // resp.user.edge_owner_to_timeline_media.edges -> [{ node: { shortcode, display_url, is_video, ... } }]
  const edges = resp?.user?.edge_owner_to_timeline_media?.edges || [];
  return edges.map(e => {
    const n = e.node || {};
    return {
      id: n.id,
      code: n.shortcode,
      isVideo: !!n.is_video,
      thumbnail: n.display_url,
      url: n.shortcode ? `https://www.instagram.com/p/${n.shortcode}/` : undefined,
      caption: n.edge_media_to_caption?.edges?.[0]?.node?.text || '',
      takenAt: n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000) : undefined,
    };
  });
}

export { postToInstagram, getInstagramPosts };