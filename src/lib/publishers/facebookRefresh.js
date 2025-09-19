/**
 * Funciones para manejar el refresh automático de tokens de Facebook
 */

/**
 * Refresca el access token de Facebook usando el endpoint de intercambio de tokens
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @param {string} currentToken - Token actual de Facebook
 * @returns {Promise<string>} Nuevo access token
 */
export async function refreshFacebookAccessToken(supabase, userId, currentToken) {
  try {
    console.log('🔄 Refrescando token de Facebook...');
    
    // Facebook usa un endpoint diferente para extender tokens
    // Intercambia un token de corta duración por uno de larga duración
    const response = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${currentToken}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error refrescando token de Facebook:', data);
      
      // Si el token está expirado o revocado
      if (data.error?.code === 190 || data.error?.message?.includes('expired') || data.error?.message?.includes('revoked')) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error(
        data.error?.message || data.error || 'Error refrescando token de Facebook'
      );
    }

    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 5184000; // 60 días por defecto para tokens de larga duración
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log('✅ Token de Facebook refrescado exitosamente:', {
      expiresIn,
      newExpiresAt,
    });

    // Actualizar el token en la base de datos
    const { error } = await supabase
      .from('profiles')
      .update({
        facebook_access_token: newAccessToken,
        facebook_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error actualizando token de Facebook en la base de datos:', error);
      throw new Error('Error actualizando token en la base de datos');
    }

    return newAccessToken;
  } catch (error) {
    console.error('❌ Error en refreshFacebookAccessToken:', error);
    throw error;
  }
}

/**
 * Obtiene un token válido de Facebook, refrescándolo automáticamente si es necesario
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Token info con token válido
 */
export async function getValidFacebookToken(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'facebook_access_token, facebook_expires_at, facebook_user_id, facebook_user_name, facebook_granted_scopes, facebook_page_id, facebook_page_name'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const token = data?.facebook_access_token || null;
    const expiresAt = data?.facebook_expires_at || null;
    const fbUserId = data?.facebook_user_id || null;
    const fbUserName = data?.facebook_user_name || null;
    const grantedScopes = data?.facebook_granted_scopes || null;
    const pageId = data?.facebook_page_id || null;
    const pageName = data?.facebook_page_name || null;

    if (!token) {
      throw new Error('Session expirada de Facebook.');
    }

    // Verificar si el token está expirado o expirará en los próximos 7 días
    // Facebook tokens de larga duración duran ~60 días, así que refrescamos con más anticipación
    const shouldRefresh = !expiresAt || 
      (expiresAt && new Date(expiresAt).getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (shouldRefresh) {
      console.log('⚠️ Token de Facebook expirado o próximo a expirar, refrescando...');
      try {
        const newToken = await refreshFacebookAccessToken(supabase, userId, token);
        
        // Obtener los datos actualizados después del refresh
        const { data: updatedData } = await supabase
          .from('profiles')
          .select(
            'facebook_access_token, facebook_expires_at, facebook_user_id, facebook_user_name, facebook_granted_scopes, facebook_page_id, facebook_page_name'
          )
          .eq('id', userId)
          .maybeSingle();

        return {
          token: newToken,
          expiresAt: updatedData?.facebook_expires_at || null,
          fbUserId: updatedData?.facebook_user_id || fbUserId,
          fbUserName: updatedData?.facebook_user_name || fbUserName,
          grantedScopes: updatedData?.facebook_granted_scopes || grantedScopes,
          pageId: updatedData?.facebook_page_id || pageId,
          pageName: updatedData?.facebook_page_name || pageName,
        };
      } catch (refreshError) {
        console.error('❌ Error refrescando token de Facebook:', refreshError.message);
        
        // Si el token está expirado, limpiar los tokens de la base de datos
        if (refreshError.message === 'REFRESH_TOKEN_EXPIRED') {
          console.log('🧹 Limpiando tokens expirados de Facebook de la base de datos...');
          await supabase
            .from('profiles')
            .update({
              facebook_access_token: null,
              facebook_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
            
          throw new Error(
            'El token de Facebook ha expirado. Necesitas reconectar tu cuenta de Facebook para continuar publicando.'
          );
        }
        
        throw new Error(
          `Token de Facebook expirado y no se pudo refrescar: ${refreshError.message}`
        );
      }
    }

    return { 
      token, 
      expiresAt, 
      fbUserId, 
      fbUserName, 
      grantedScopes,
      pageId,
      pageName
    };
  } catch (e) {
    console.error('❌ Error en getValidFacebookToken:', e);
    throw e;
  }
}