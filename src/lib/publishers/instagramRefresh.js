import { getSupabaseClient } from '@/lib/supabaseUniversal';

/**
 * Refresca un token de acceso de Instagram usando la API de Instagram Graph
 * @param {string} currentToken - Token actual de Instagram
 * @returns {Promise<{success: boolean, access_token?: string, expires_in?: number, error?: string}>}
 */
export async function refreshInstagramAccessToken(currentToken) {
  try {
    console.log('🔄 Intentando refrescar token de Instagram...');
    
    // Instagram Graph API endpoint para refresh de tokens
    const refreshUrl = new URL('https://graph.instagram.com/refresh_access_token');
    refreshUrl.searchParams.append('grant_type', 'ig_refresh_token');
    refreshUrl.searchParams.append('access_token', currentToken);

    const response = await fetch(refreshUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    console.log(data)
    console.log(response)
    console.log("XDDD")
    if (!response.ok) {
      console.error('❌ Error refrescando token de Instagram:', data);
      
      // Verificar si es un error de token expirado o inválido
      if (data.error?.code === 190 || 
          data.error?.message?.toLowerCase().includes('expired') ||
          data.error?.message?.toLowerCase().includes('invalid')) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error(
        data.error?.message || data.error || 'Error refrescando token de Instagram'
      );
    }

    console.log('✅ Token de Instagram refrescado exitosamente');
    
    return {
      success: true,
      access_token: data.access_token,
      expires_in: data.expires_in || 5184000, // 60 días por defecto
    };
  } catch (error) {
    console.error('❌ Error en refreshInstagramAccessToken:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Actualiza el token de Instagram en la base de datos
 * @param {string} userId - ID del usuario
 * @param {string} newToken - Nuevo token de acceso
 * @param {number} expiresIn - Tiempo de expiración en segundos
 * @returns {Promise<boolean>}
 */
async function updateInstagramTokenInDB(userId, newToken, expiresIn) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      console.error('❌ Supabase client no está disponible');
      return false;
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    const { error } = await supabase
      .from('profiles')
      .update({
        instagram_access_token: newToken,
        instagram_expires_at: expiresAt,
      })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error actualizando token de Instagram en la base de datos:', error);
      return false;
    }

    console.log('✅ Token de Instagram actualizado en la base de datos');
    return true;
  } catch (error) {
    console.error('❌ Error actualizando token de Instagram en la base de datos:', error);
    return false;
  }
}

/**
 * Obtiene un token válido de Instagram, refrescándolo automáticamente si es necesario
 * @param {string} userId - ID del usuario
 * @returns {Promise<{token: string|null, error?: string}>}
 */
export async function getValidInstagramToken(userId) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      console.error('❌ Supabase client no está disponible');
      return { success: false, error: 'Cliente de Supabase no disponible' };
    }

    // Obtener el token actual de la base de datos
    const { data, error } = await supabase
      .from('profiles')
      .select('instagram_access_token, instagram_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error obteniendo token de Instagram:', error);
      return { token: null, error: 'Error obteniendo token de Instagram' };
    }

    const currentToken = data?.instagram_access_token;
    const expiresAt = data?.instagram_expires_at;

    if (!currentToken) {
      return { token: null, error: 'No hay token de Instagram configurado' };
    }

    // Verificar si el token está próximo a expirar (menos de 7 días)
    const now = new Date();
    const expiration = new Date(expiresAt);
    const daysUntilExpiration = (expiration - now) / (1000 * 60 * 60 * 24);

    // Si el token ya expiró, limpiar de la base de datos
    if (expiration <= now) {
      console.log('🧹 Token de Instagram expirado, limpiando de la base de datos...');
      await supabase
        .from('profiles')
        .update({
          instagram_access_token: null,
          instagram_expires_at: null,
        })
        .eq('id', userId);
      
      throw new Error('Session expirada de Instagram.');
    }

    // Si el token está próximo a expirar (menos de 7 días) y tiene al menos 24 horas, intentar refrescarlo
    if (daysUntilExpiration < 7) {
      console.log(`⚠️ Token de Instagram expira en ${daysUntilExpiration.toFixed(1)} días, intentando refrescar...`);
      
      // Verificar que el token tenga al menos 24 horas (requisito de Instagram)
      const tokenAge = now - new Date(expiration.getTime() - 60 * 24 * 60 * 60 * 1000); // Asumiendo 60 días de vida útil
      const hoursOld = tokenAge / (1000 * 60 * 60);
      
      if (hoursOld >= 24) {
        const refreshResult = await refreshInstagramAccessToken(currentToken);
        
        if (refreshResult.success) {
          const updateSuccess = await updateInstagramTokenInDB(
            userId,
            refreshResult.access_token,
            refreshResult.expires_in
          );
          
          if (updateSuccess) {
            console.log('✅ Token de Instagram refrescado y actualizado exitosamente');
            return { token: refreshResult.access_token };
          } else {
            console.error('❌ Error actualizando token refrescado en la base de datos');
            // Continuar con el token actual si no se pudo actualizar
            return { token: currentToken };
          }
        } else {
          console.error('❌ Error refrescando token de Instagram:', refreshResult.error);
          
          // Si el refresh falló por token expirado, limpiar la base de datos
          if (refreshResult.error === 'REFRESH_TOKEN_EXPIRED') {
            await supabase
              .from('profiles')
              .update({
                instagram_access_token: null,
                instagram_expires_at: null,
              })
              .eq('id', userId);
            
            throw new Error(
              `Token de Instagram expirado y no se pudo refrescar: ${refreshResult.error}`
            );
          }
          
          // Para otros errores, continuar con el token actual
          console.log('⚠️ Continuando con el token actual de Instagram a pesar del error de refresh');
          return { token: currentToken };
        }
      } else {
        console.log('⚠️ Token de Instagram muy nuevo para refrescar (menos de 24 horas), usando token actual');
        return { token: currentToken };
      }
    }

    // Token válido y no necesita refresh
    return { token: currentToken };
  } catch (e) {
    console.error('❌ Error en getValidInstagramToken:', e);
    return { token: null, error: e.message };
  }
}