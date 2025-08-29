const axios = require('axios');
const config = require('../config');

// Publicar en Facebook Page. Si hay imagen/video, se sube el medio y se crea post.
async function postToFacebook({ message, link, imageUrl, videoUrl }) {
  const pageId = config.facebook.pageId;
  const accessToken = config.facebook.accessToken;

  try {
    if (imageUrl) {
      const url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      const { data } = await axios.post(url, {
        caption: message,
        url: imageUrl,
        access_token: accessToken,
      });
      return { platform: 'facebook', id: data.id, url: `https://facebook.com/${pageId}/posts/${data.id}` };
    }

    if (videoUrl) {
      const url = `https://graph.facebook.com/v19.0/${pageId}/videos`;
      const { data } = await axios.post(url, {
        description: message,
        file_url: videoUrl,
        access_token: accessToken,
      });
      return { platform: 'facebook', id: data.id, url: `https://facebook.com/${pageId}/videos/${data.id}` };
    }

    // Solo texto
    const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    const { data } = await axios.post(url, {
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

// Publicar en Instagram Business Account (requiere imagen o video previamente hosteado mediante URL pública)
async function postToInstagram({ caption, imageUrl, videoUrl }) {
  const igId = config.instagram.businessAccountId;
  const accessToken = config.instagram.accessToken;

  try {
    let creationId;
    if (imageUrl) {
      // Crear media container
      const { data: createData } = await axios.post(
        `https://graph.facebook.com/v19.0/${igId}/media`,
        {
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }
      );
      creationId = createData.id;
    } else if (videoUrl) {
      const { data: createData } = await axios.post(
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
    const { data: publishData } = await axios.post(
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

module.exports = { postToFacebook, postToInstagram };