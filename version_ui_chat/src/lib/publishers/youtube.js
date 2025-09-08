export async function getYouTubeToken(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("youtube_access_token, youtube_refresh_token, youtube_expires_at, youtube_channel_id, youtube_channel_name")
      .eq("id", userId)
      .maybeSingle();
      
    if (error) {
      throw error;
    }
    
    const token = data?.youtube_access_token || null;
    const refreshToken = data?.youtube_refresh_token || null;
    const expiresAt = data?.youtube_expires_at || null;
    const channelId = data?.youtube_channel_id || null;
    const channelName = data?.youtube_channel_name || null;
    
    return { token, refreshToken, expiresAt, channelId, channelName };
  } catch (e) {
    return { token: null, refreshToken: null, expiresAt: null, channelId: null, channelName: null };
  }
}

export async function refreshYouTubeAccessToken(supabase, userId, refreshToken) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error_description || 'Error refrescando token de YouTube');
    }
    
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    const { error } = await supabase
      .from('profiles')
      .update({
        youtube_access_token: newAccessToken,
        youtube_expires_at: newExpiresAt,
      })
      .eq('id', userId);
    
    if (error) {
      throw new Error('Error actualizando token en la base de datos');
    }
    
    return newAccessToken;
    
  } catch (error) {
    throw error;
  }
}

export async function publishToYouTube({ caption, videoUrl, userId, supabase }) {
  try {
    if (!videoUrl) {
      throw new Error('YouTube requiere un video');
    }
    
    let { token, refreshToken, expiresAt } = await getYouTubeToken(supabase, userId);
    
    if (!token) {
      throw new Error('No hay token de YouTube configurado');
    }
    
    if (expiresAt && new Date(expiresAt) < new Date()) {
      if (!refreshToken) {
        throw new Error('Token de YouTube expirado y no hay refresh token');
      }
      token = await refreshYouTubeAccessToken(supabase, userId, refreshToken);
    }
    
    const cleanToken = token.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
    
    const videoMetadata = {
      snippet: {
        title: caption ? caption.substring(0, 100) : 'Video sin título',
        description: caption || '',
        tags: [],
        categoryId: '22',
      },
      status: {
        privacyStatus: 'public',
      },
    };
    
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Error descargando el video');
    }
    
    const videoBlob = await videoResponse.blob();
    
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(videoMetadata));
    formData.append('media', videoBlob, 'video.mp4');
    
    const uploadResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
      },
      body: formData,
    });
    
    const uploadData = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      const errorMsg = uploadData?.error?.message || 'Error subiendo video a YouTube';
      throw new Error(errorMsg);
    }
    
    const videoId = uploadData.id;
    
    return {
      platform: 'youtube',
      success: true,
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
    
  } catch (error) {
    return {
      platform: 'youtube',
      success: false,
      error: error.message
    };
  }
}