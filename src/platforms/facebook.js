import http from '../http.js';
import config from '../config.js';

// Publicar en Facebook Page. Si hay imagen/video, se sube el medio y se crea post.
async function postToFacebook({ message, link, imageUrl, videoUrl }) {
  const pageId = config.facebook.pageId;
  const accessToken = config.facebook.accessToken;

  try {
    if (imageUrl) {
      const url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      const { data } = await http.post(url, {
        caption: message,
        url: imageUrl,
        access_token: accessToken,
      });
      return { platform: 'facebook', id: data.id, url: `https://facebook.com/${pageId}/posts/${data.id}` };
    }

    if (videoUrl) {
      const url = `https://graph.facebook.com/v19.0/${pageId}/videos`;
      const { data } = await http.post(url, {
        description: message,
        file_url: videoUrl,
        access_token: accessToken,
      });
      return { platform: 'facebook', id: data.id, url: `https://facebook.com/${pageId}/videos/${data.id}` };
    }

    // Solo texto
    const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    const { data } = await http.post(url, {
      message,
      access_token: accessToken,
      link,
    });
    return { platform: 'facebook', id: data.id, url: `https://facebook.com/${pageId}/posts/${data.id}` };
  } catch (err) {
    const error = err?.response?.data || err.message;
    console.error('Facebook post error:', error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

export { postToFacebook };