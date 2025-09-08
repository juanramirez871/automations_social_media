// Instagram Publisher Module

/**
 * Obtiene el token de Instagram desde la base de datos
 */
export async function getInstagramToken(supabase, userId) {
  try {
    console.log('🔍 Buscando token de Instagram para userId:', userId);
    
    const { data, error } = await supabase
      .from("profiles")
      .select("instagram_access_token, instagram_expires_at, instagram_user_id, instagram_username, instagram_granted_scopes")
      .eq("id", userId)
      .maybeSingle();
      
    console.log('📊 Resultado de consulta DB:', { data, error });
    
    if (error) {
      console.error('❌ Error en consulta DB:', error);
      throw error;
    }
    
    const token = data?.instagram_access_token || null;
    const expiresAt = data?.instagram_expires_at || null;
    const igUserId = data?.instagram_user_id || null;
    const igUsername = data?.instagram_username || null;
    const grantedScopes = data?.instagram_granted_scopes || null;
    
    console.log('🔑 Token extraído:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      igUserId,
      igUsername,
      expiresAt
    });
    
    return { token, expiresAt, igUserId, igUsername, grantedScopes };
  } catch (e) {
    console.error("❌ Error obteniendo token de Instagram:", e?.message || e);
    return { token: null, expiresAt: null, igUserId: null, igUsername: null, grantedScopes: null };
  }
}

/**
 * Publica contenido en Instagram
 */
export async function publishToInstagram({ caption, imageUrl, videoUrl, userId, supabase }) {
  try {
    // Obtener token de Instagram del usuario
    const { token, expiresAt, igUserId } = await getInstagramToken(supabase, userId);
    
    if (!token) {
      throw new Error('No hay token de Instagram configurado');
    }
    
    // Limpiar el token de espacios, saltos de línea y caracteres extra
    const cleanToken = token.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
    console.log('🧹 Token limpiado:', {
      originalLength: token.length,
      cleanedLength: cleanToken.length,
      hadWhitespace: token !== cleanToken,
      tokenStart: cleanToken.substring(0, 20) + '...',
      tokenEnd: '...' + cleanToken.substring(cleanToken.length - 10)
    });
    
    // Verificar si el token ha expirado
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new Error('Token de Instagram expirado');
    }
    
    if (!imageUrl && !videoUrl) {
      throw new Error('Instagram requiere una imagen o video');
    }
    
    // Publicar usando Instagram Graph API
    const mediaUrl = imageUrl || videoUrl;
    const mediaType = imageUrl ? 'IMAGE' : 'VIDEO';
    
    // Paso 1: Crear container de media
    console.log('📤 Enviando petición a Instagram API...');
    
    const containerParams = new URLSearchParams({
      image_url: mediaType === 'IMAGE' ? mediaUrl : undefined,
      video_url: mediaType === 'VIDEO' ? mediaUrl : undefined,
      media_type: mediaType,
      caption: caption || '',
      access_token: cleanToken
    });
    
    // Remover parámetros undefined
    for (const [key, value] of [...containerParams.entries()]) {
      if (value === undefined || value === 'undefined') {
        containerParams.delete(key);
      }
    }
    
    console.log('📋 Parámetros del container:', Object.fromEntries(containerParams));
    
    const containerResponse = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: containerParams.toString()
    });
    
    const containerData = await containerResponse.json();
    console.log('📦 Respuesta del container:', containerData);
    
    if (!containerResponse.ok) {
      const errorMsg = containerData?.error?.message || 'Error creando container de Instagram';
      console.error('❌ Error en container:', containerData);
      throw new Error(errorMsg);
    }
    
    const containerId = containerData.id;
    console.log('✅ Container creado:', containerId);
    
    // Paso 2: Publicar el container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: cleanToken
    });
    
    console.log('🚀 Publicando container...');
    const publishResponse = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams.toString()
    });
    
    const publishData = await publishResponse.json();
    console.log('📢 Respuesta de publicación:', publishData);
    
    if (!publishResponse.ok) {
      const errorMsg = publishData?.error?.message || 'Error publicando en Instagram';
      console.error('❌ Error en publicación:', publishData);
      throw new Error(errorMsg);
    }
    
    const mediaId = publishData.id;
    console.log('🎉 Publicado exitosamente en Instagram:', mediaId);
    
    return {
      platform: 'instagram',
      success: true,
      id: mediaId,
      url: `https://www.instagram.com/p/${mediaId}/`
    };
    
  } catch (error) {
    console.error('Error publicando en Instagram:', error);
    return {
      platform: 'instagram',
      success: false,
      error: error.message
    };
  }
}