/**
 * Funciones para manejar el refresh automático de tokens de TikTok
 */

/**
 * Refresca el access token de TikTok usando el refresh token
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @param {string} refreshToken - Refresh token de TikTok
 * @returns {Promise<string>} Nuevo access token
 */
export async function refreshTikTokAccessToken(supabase, userId, refreshToken) {
  try {
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error refrescando token de TikTok:', data);
      throw new Error(
        data.error_description || data.error || 'Error refrescando token de TikTok'
      );
    }

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || refreshToken; // TikTok puede devolver un nuevo refresh token
    const expiresIn = data.expires_in || 86400; // 24 horas por defecto
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log('Token de TikTok refrescado exitosamente:', {
      expiresIn,
      newExpiresAt,
      hasNewRefreshToken: newRefreshToken !== refreshToken
    });

    // Actualizar el token en la base de datos
    const { error } = await supabase
      .from('profiles')
      .update({
        tiktok_access_token: newAccessToken,
        tiktok_refresh_token: newRefreshToken,
        tiktok_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error actualizando token de TikTok en la base de datos:', error);
      throw new Error('Error actualizando token en la base de datos');
    }

    return newAccessToken;
  } catch (error) {
    console.error('Error en refreshTikTokAccessToken:', error);
    throw error;
  }
}

/**
 * Obtiene un token válido de TikTok, refrescándolo automáticamente si es necesario
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Token info con token válido
 */
export async function getValidTikTokToken(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'tiktok_access_token, tiktok_refresh_token, tiktok_expires_at, tiktok_open_id, tiktok_granted_scopes'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const token = data?.tiktok_access_token || null;
    const refreshToken = data?.tiktok_refresh_token || null;
    const expiresAt = data?.tiktok_expires_at || null;
    const openId = data?.tiktok_open_id || null;
    const grantedScopes = data?.tiktok_granted_scopes || null;

    if (!token) {
      throw new Error('No hay token de TikTok configurado');
    }

    // Verificar si el token está expirado o expirará en los próximos 5 minutos
    const shouldRefresh = !expiresAt || 
      (expiresAt && new Date(expiresAt).getTime() < Date.now() + 5 * 60 * 1000);

    if (shouldRefresh && refreshToken) {
      console.log('Token de TikTok expirado o próximo a expirar, refrescando...');
      try {
        const newToken = await refreshTikTokAccessToken(supabase, userId, refreshToken);
        
        // Obtener los datos actualizados después del refresh
        const { data: updatedData } = await supabase
          .from('profiles')
          .select(
            'tiktok_access_token, tiktok_refresh_token, tiktok_expires_at, tiktok_open_id, tiktok_granted_scopes'
          )
          .eq('id', userId)
          .maybeSingle();

        return {
          token: newToken,
          refreshToken: updatedData?.tiktok_refresh_token || refreshToken,
          expiresAt: updatedData?.tiktok_expires_at || null,
          openId: updatedData?.tiktok_open_id || openId,
          grantedScopes: updatedData?.tiktok_granted_scopes || grantedScopes,
        };
      } catch (refreshError) {
        console.error('Error refrescando token de TikTok:', refreshError.message);
        throw new Error(
          `Token de TikTok expirado y no se pudo refrescar: ${refreshError.message}`
        );
      }
    } else if (shouldRefresh && !refreshToken) {
      throw new Error(
        'Token de TikTok expirado y no hay refresh token disponible. Necesitas reconectar tu cuenta.'
      );
    }

    return { token, refreshToken, expiresAt, openId, grantedScopes };
  } catch (e) {
    console.error('Error en getValidTikTokToken:', e);
    throw e;
  }
}