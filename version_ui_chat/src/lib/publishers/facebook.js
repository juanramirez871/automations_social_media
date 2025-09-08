// Facebook Publisher Module

/**
 * Obtiene el token de Facebook desde la base de datos
 */
export async function getFacebookToken(supabase, userId) {
  try {
    console.log('🔍 Buscando token de Facebook para userId:', userId);
    
    const { data, error } = await supabase
      .from("profiles")
      .select("facebook_access_token, facebook_expires_at, facebook_page_id, facebook_page_name")
      .eq("id", userId)
      .maybeSingle();
      
    console.log('📊 Resultado de consulta DB Facebook:', { data, error });
    
    if (error) {
      console.error('❌ Error en consulta DB Facebook:', error);
      throw error;
    }
    
    const token = data?.facebook_access_token || null;
    const expiresAt = data?.facebook_expires_at || null;
    const pageId = data?.facebook_page_id || null;
    const pageName = data?.facebook_page_name || null;
    
    console.log('🔑 Token Facebook extraído:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      pageId,
      pageName,
      expiresAt
    });
    
    return { token, expiresAt, pageId, pageName };
  } catch (e) {
    console.error("❌ Error obteniendo token de Facebook:", e?.message || e);
    return { token: null, expiresAt: null, pageId: null, pageName: null };
  }
}

/**
 * Publica contenido en Facebook
 */
export async function publishToFacebook({ caption, imageUrl, videoUrl, userId, supabase }) {
  try {
    // Obtener token de Facebook del usuario
    const { token, expiresAt, pageId } = await getFacebookToken(supabase, userId);
    
    if (!token) {
      throw new Error('No hay token de Facebook configurado');
    }
    
    // Verificar si el token ha expirado
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new Error('Token de Facebook expirado');
    }
    
    if (!pageId) {
      throw new Error('No hay página de Facebook configurada');
    }
    
    // Limpiar el token
    const cleanToken = token.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
    
    let postData;
    let endpoint;
    
    if (imageUrl || videoUrl) {
      // Publicar con media
      const mediaUrl = imageUrl || videoUrl;
      const mediaType = imageUrl ? 'photo' : 'video';
      
      endpoint = `https://graph.facebook.com/v21.0/${pageId}/${mediaType}s`;
      postData = {
        url: mediaUrl,
        caption: caption || '',
        access_token: cleanToken
      };
    } else {
      // Publicar solo texto
      endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
      postData = {
        message: caption || '',
        access_token: cleanToken
      };
    }
    
    console.log('📤 Enviando petición a Facebook API:', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });
    
    const responseData = await response.json();
    console.log('📢 Respuesta de Facebook:', responseData);
    
    if (!response.ok) {
      const errorMsg = responseData?.error?.message || 'Error publicando en Facebook';
      console.error('❌ Error en Facebook:', responseData);
      throw new Error(errorMsg);
    }
    
    const postId = responseData.id || responseData.post_id;
    console.log('🎉 Publicado exitosamente en Facebook:', postId);
    
    return {
      platform: 'facebook',
      success: true,
      id: postId,
      url: `https://www.facebook.com/${postId}`
    };
    
  } catch (error) {
    console.error('Error publicando en Facebook:', error);
    return {
      platform: 'facebook',
      success: false,
      error: error.message
    };
  }
}