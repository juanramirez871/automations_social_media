import http from '../http.js';
import config from '../config.js';

// Publicar en Instagram Business Account (requiere imagen o video previamente hosteado mediante URL pública)
async function postToInstagram({ caption, imageUrl, videoUrl }) {
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
    console.error('Instagram post error:', error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

export { postToInstagram };