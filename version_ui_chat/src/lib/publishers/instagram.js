export async function getInstagramToken(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("instagram_access_token, instagram_expires_at, instagram_user_id, instagram_username, instagram_granted_scopes")
      .eq("id", userId)
      .maybeSingle();
      
    if (error) {
      throw error;
    }
    
    const token = data?.instagram_access_token || null;
    const expiresAt = data?.instagram_expires_at || null;
    const igUserId = data?.instagram_user_id || null;
    const igUsername = data?.instagram_username || null;
    const grantedScopes = data?.instagram_granted_scopes || null;
    
    return { token, expiresAt, igUserId, igUsername, grantedScopes };
  } catch (e) {
    return { token: null, expiresAt: null, igUserId: null, igUsername: null, grantedScopes: null };
  }
}

export async function publishToInstagram({ caption, imageUrl, videoUrl, userId, supabase }) {
  try {
    const { token, expiresAt, igUserId } = await getInstagramToken(supabase, userId);
    
    if (!token) {
      throw new Error('No hay token de Instagram configurado');
    }
    
    const cleanToken = token.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
    
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new Error('Token de Instagram expirado');
    }
    
    if (!imageUrl && !videoUrl) {
      throw new Error('Instagram requiere una imagen o video');
    }
    
    const mediaUrl = imageUrl || videoUrl;
    const mediaType = imageUrl ? 'IMAGE' : 'VIDEO';
    
    const containerParams = new URLSearchParams({
      image_url: mediaType === 'IMAGE' ? mediaUrl : undefined,
      video_url: mediaType === 'VIDEO' ? mediaUrl : undefined,
      media_type: mediaType,
      caption: caption || '',
      access_token: cleanToken
    });
    
    for (const [key, value] of [...containerParams.entries()]) {
      if (value === undefined || value === 'undefined') {
        containerParams.delete(key);
      }
    }
    
    const containerResponse = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: containerParams.toString()
    });
    
    const containerData = await containerResponse.json();
    
    if (!containerResponse.ok) {
      const errorMsg = containerData?.error?.message || 'Error creando container de Instagram';
      throw new Error(errorMsg);
    }
    
    const containerId = containerData.id;
    
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: cleanToken
    });
    
    const publishResponse = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams.toString()
    });
    
    const publishData = await publishResponse.json();
    
    if (!publishResponse.ok) {
      const errorMsg = publishData?.error?.message || 'Error publicando en Instagram';
      throw new Error(errorMsg);
    }
    
    const mediaId = publishData.id;
    
    return {
      platform: 'instagram',
      success: true,
      id: mediaId,
      url: `https://www.instagram.com/p/${mediaId}/`
    };
    
  } catch (error) {
    return {
      platform: 'instagram',
      success: false,
      error: error.message
    };
  }
}