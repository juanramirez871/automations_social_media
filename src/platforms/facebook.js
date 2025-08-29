import config from '../config.js';
import { Facebook } from 'fb';
import { logger } from '../logger.js';

function getFbClient() {
  const fb = new Facebook({ version: 'v19.0' });
  if (config.facebook.accessToken) {
    fb.setAccessToken(config.facebook.accessToken);
  }
  return fb;
}

function fbApi(fb, path, method, params) {
  return new Promise((resolve, reject) => {
    fb.api(path, method, params, (res) => {
      if (!res || res.error) {
        return reject(res?.error || new Error('Facebook API error'));
      }
      resolve(res);
    });
  });
}

// Publicar en Facebook Page. Si hay imagen/video, se sube el medio y se crea post.
async function postToFacebook({ message, link, imageUrl, videoUrl }) {
  const pageId = config.facebook.pageId;

  try {
    const fb = getFbClient();

    if (imageUrl) {
      // Subir foto por URL remota
      const res = await fbApi(fb, `${pageId}/photos`, 'post', {
        caption: message,
        url: imageUrl,
      });
      const postId = res.post_id || res.id;
      return { platform: 'facebook', id: postId, url: postId ? `https://facebook.com/${pageId}/posts/${postId}` : undefined };
    }

    if (videoUrl) {
      // Subir video por URL remota
      const res = await fbApi(fb, `${pageId}/videos`, 'post', {
        description: message,
        file_url: videoUrl,
      });
      return { platform: 'facebook', id: res.id, url: res.id ? `https://facebook.com/${pageId}/videos/${res.id}` : undefined };
    }

    // Solo texto (opcionalmente con link)
    const res = await fbApi(fb, `${pageId}/feed`, 'post', {
      message,
      link,
    });
    return { platform: 'facebook', id: res.id, url: res.id ? `https://facebook.com/${pageId}/posts/${res.id}` : undefined };
  } catch (err) {
    const error = err?.response?.data || err?.message || err;
    logger.error({ err: error }, 'Facebook post error');
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

export { postToFacebook };