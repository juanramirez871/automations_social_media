export async function getFacebookToken(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'facebook_access_token, facebook_expires_at, facebook_page_id, facebook_page_name'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const token = data?.facebook_access_token || null;
    const expiresAt = data?.facebook_expires_at || null;
    const pageId = data?.facebook_page_id || null;
    const pageName = data?.facebook_page_name || null;

    return { token, expiresAt, pageId, pageName };
  } catch (e) {
    return { token: null, expiresAt: null, pageId: null, pageName: null };
  }
}

export async function publishToFacebook({
  caption,
  imageUrl,
  videoUrl,
  userId,
  supabase,
}) {
  try {
    const { token, expiresAt, pageId } = await getFacebookToken(
      supabase,
      userId
    );

    if (!token) {
      throw new Error('No hay token de Facebook configurado');
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new Error('Token de Facebook expirado');
    }

    if (!pageId) {
      throw new Error('No hay página de Facebook configurada');
    }

    const cleanToken = token
      .trim()
      .replace(/\s+/g, '')
      .replace(/[\r\n\t]/g, '');

    let postData;
    let endpoint;

    if (imageUrl || videoUrl) {
      const mediaUrl = imageUrl || videoUrl;
      const mediaType = imageUrl ? 'photo' : 'video';

      endpoint = `https://graph.facebook.com/v21.0/${pageId}/${mediaType}s`;
      postData = {
        url: mediaUrl,
        caption: caption || '',
        access_token: cleanToken,
      };
    } else {
      endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
      postData = {
        message: caption || '',
        access_token: cleanToken,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMsg =
        responseData?.error?.message || 'Error publicando en Facebook';

      throw new Error(errorMsg);
    }

    const postId = responseData.id || responseData.post_id;

    return {
      platform: 'facebook',
      success: true,
      id: postId,
      url: `https://www.facebook.com/${postId}`,
    };
  } catch (error) {
    return {
      platform: 'facebook',
      success: false,
      error: error.message,
    };
  }
}
