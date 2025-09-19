/**
 * Funciones para manejar el refresh automático de tokens de YouTube
 */

/**
 * Refresca el access token de YouTube usando el refresh token
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @param {string} refreshToken - Refresh token de YouTube
 * @returns {Promise<string>} Nuevo access token
 */
export async function refreshYouTubeAccessToken(supabase, userId, refreshToken) {
  try {
    console.log('🔄 Refrescando token de YouTube...');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error refrescando token de YouTube:', data);
      
      // Si el refresh token también está expirado o revocado
      if (data.error === 'invalid_grant' || data.error_description?.includes('expired') || data.error_description?.includes('revoked')) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error(
        data.error_description || data.error || 'Error refrescando token de YouTube'
      );
    }

    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600; // 1 hora por defecto
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log('✅ Token de YouTube refrescado exitosamente:', {
      expiresIn,
      newExpiresAt,
    });

    // Actualizar el token en la base de datos
    const { error } = await supabase
      .from('profiles')
      .update({
        youtube_access_token: newAccessToken,
        youtube_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error actualizando token de YouTube en la base de datos:', error);
      throw new Error('Error actualizando token en la base de datos');
    }

    return newAccessToken;
  } catch (error) {
    console.error('❌ Error en refreshYouTubeAccessToken:', error);
    throw error;
  }
}

/**
 * Obtiene un token válido de YouTube, refrescándolo automáticamente si es necesario
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Token info con token válido
 */
export async function getValidYouTubeToken(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'youtube_access_token, youtube_refresh_token, youtube_expires_at, youtube_channel_id, youtube_channel_title, youtube_granted_scopes'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const token = data?.youtube_access_token || null;
    const refreshToken = data?.youtube_refresh_token || null;
    const expiresAt = data?.youtube_expires_at || null;
    const channelId = data?.youtube_channel_id || null;
    const channelTitle = data?.youtube_channel_title || null;
    const grantedScopes = data?.youtube_granted_scopes || null;

    if (!token) {
      throw new Error('Session expirada de youtube.');
    }

    // Verificar si el token está expirado o expirará en los próximos 5 minutos
    const shouldRefresh = !expiresAt || 
      (expiresAt && new Date(expiresAt).getTime() < Date.now() + 5 * 60 * 1000);

    if (shouldRefresh && refreshToken) {
      console.log('⚠️ Token de YouTube expirado o próximo a expirar, refrescando...');
      try {
        const newToken = await refreshYouTubeAccessToken(supabase, userId, refreshToken);
        
        // Obtener los datos actualizados después del refresh
        const { data: updatedData } = await supabase
          .from('profiles')
          .select(
            'youtube_access_token, youtube_refresh_token, youtube_expires_at, youtube_channel_id, youtube_channel_title, youtube_granted_scopes'
          )
          .eq('id', userId)
          .maybeSingle();

        return {
          token: newToken,
          refreshToken: updatedData?.youtube_refresh_token || refreshToken,
          expiresAt: updatedData?.youtube_expires_at || null,
          channelId: updatedData?.youtube_channel_id || channelId,
          channelTitle: updatedData?.youtube_channel_title || channelTitle,
          grantedScopes: updatedData?.youtube_granted_scopes || grantedScopes,
        };
      } catch (refreshError) {
        console.error('❌ Error refrescando token de YouTube:', refreshError.message);
        
        // Si el refresh token está expirado, limpiar los tokens de la base de datos
        if (refreshError.message === 'REFRESH_TOKEN_EXPIRED') {
          console.log('🧹 Limpiando tokens expirados de YouTube de la base de datos...');
          await supabase
            .from('profiles')
            .update({
              youtube_access_token: null,
              youtube_refresh_token: null,
              youtube_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
            
          throw new Error(
            'El refresh token de YouTube ha expirado. Necesitas reconectar tu cuenta de YouTube para continuar publicando.'
          );
        }
        
        throw new Error(
          `Token de YouTube expirado y no se pudo refrescar: ${refreshError.message}`
        );
      }
    } else if (shouldRefresh && !refreshToken) {
      throw new Error(
        'Token de YouTube expirado y no hay refresh token disponible. Necesitas reconectar tu cuenta.'
      );
    }

    return { 
      token, 
      refreshToken, 
      expiresAt, 
      channelId, 
      channelTitle, 
      grantedScopes 
    };
  } catch (e) {
    console.error('❌ Error en getValidYouTubeToken:', e);
    throw e;
  }
}