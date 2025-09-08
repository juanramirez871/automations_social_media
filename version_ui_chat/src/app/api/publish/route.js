import { NextResponse } from 'next/server';

// Función para obtener token de Instagram (versión servidor)
async function getInstagramTokenServer(supabase, userId) {
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

// Función para obtener token de Facebook (versión servidor)
async function getFacebookTokenServer(supabase, userId) {
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

// NUEVO: Funciones YouTube (versión servidor)
async function getYouTubeTokenServer(supabase, userId) {
  try {
    console.log('🔍 Buscando token de YouTube para userId:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('youtube_access_token, youtube_refresh_token, youtube_expires_at, youtube_channel_id, youtube_channel_title, youtube_granted_scopes')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    const token = data?.youtube_access_token || null;
    const refreshToken = data?.youtube_refresh_token || null;
    const expiresAt = data?.youtube_expires_at || null;
    const channelId = data?.youtube_channel_id || null;
    const channelTitle = data?.youtube_channel_title || null;
    const grantedScopes = data?.youtube_granted_scopes || null;
    console.log('🔑 Token YouTube extraído:', { hasToken: !!token, hasRefresh: !!refreshToken, channelId, expiresAt });
    return { token, refreshToken, expiresAt, channelId, channelTitle, grantedScopes };
  } catch (e) {
    console.error('❌ Error obteniendo token de YouTube:', e?.message || e);
    return { token: null, refreshToken: null, expiresAt: null, channelId: null, channelTitle: null, grantedScopes: null };
  }
}

// NUEVO: Funciones TikTok (versión servidor)
async function getTikTokTokenServer(supabase, userId) {
  try {
    console.log('🔍 Buscando token de TikTok para userId:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('tiktok_access_token, tiktok_expires_at, tiktok_open_id, tiktok_granted_scopes')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    const token = data?.tiktok_access_token || null;
    const expiresAt = data?.tiktok_expires_at || null;
    const openId = data?.tiktok_open_id || null;
    const grantedScopes = data?.tiktok_granted_scopes || null;
    console.log('🔑 Token TikTok extraído:', { hasToken: !!token, openId, expiresAt, scopesCount: Array.isArray(grantedScopes) ? grantedScopes.length : null });
    return { token, expiresAt, openId, grantedScopes };
  } catch (e) {
    console.error('❌ Error obteniendo token de TikTok:', e?.message || e);
    return { token: null, expiresAt: null, openId: null, grantedScopes: null };
  }
}

// NUEVO: Utilidad para usar el dominio verificado en PULL_FROM_URL
function normalizeVerifiedTikTokUrl(inputUrl) {
  try {
    const u = new URL(inputUrl);
    if (u.hostname === 'res.cloudinary.com') {
      // Proxiar vía Next.js rewrite: /tiktok/cdn/:path* -> res.cloudinary.com/:path*
      return `https://media.kaioficial.com/tiktok/cdn${u.pathname}${u.search}`;
    }
    return inputUrl;
  } catch (e) {
    return inputUrl;
  }
}

// NUEVO: Función auxiliar para obtener metadatos del archivo remoto
async function getRemoteFileMeta(videoUrl) {
  let contentLength = null;
  let contentType = 'application/octet-stream';
  try {
    const head = await fetch(videoUrl, { method: 'HEAD' });
    if (head.ok) {
      const len = head.headers.get('content-length');
      const ctype = head.headers.get('content-type');
      if (len && !isNaN(Number(len))) contentLength = Number(len);
      if (ctype) contentType = ctype;
    }
  } catch (e) {
    console.warn('⚠️ HEAD video falló, continuará con GET directo');
  }
  return { contentLength, contentType };
}

// NUEVO: Helpers para FILE_UPLOAD cuando PULL_FROM_URL no es posible
async function tiktokInitFileUpload({ token, mode, title, privacyLevel, videoUrl }) {
  const isDirect = mode === 'direct';
  const url = isDirect
    ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
    : 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
  const effectivePrivacy = privacyLevel || 'SELF_ONLY';

  // Obtener metadata del video para chunking
  const { contentLength, contentType } = await getRemoteFileMeta(videoUrl);
  
  // Aplicar reglas estrictas de chunking de TikTok
  const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_CHUNK_SIZE = 64 * 1024 * 1024; // 64MB
  
  let chunkSize, totalChunks;
  
  if (!contentLength || contentLength < MIN_CHUNK_SIZE) {
    // Videos <5MB: DEBEN subirse completos
    chunkSize = contentLength || MIN_CHUNK_SIZE;
    totalChunks = 1;
  } else {
    // Para videos >=5MB, usar estrategia conservadora:
    // Si el video es pequeño (<20MB), subirlo completo para evitar chunks muy pequeños
    if (contentLength < 20 * 1024 * 1024) {
      chunkSize = contentLength;
      totalChunks = 1;
    } else {
      // Videos grandes: usar chunks de 10MB
      chunkSize = 10 * 1024 * 1024;
      totalChunks = Math.floor(contentLength / chunkSize);
      if (contentLength % chunkSize > 0) {
        totalChunks += 1;
      }
    }
  }
  
  console.log(`📊 TikTok chunking: video_size=${contentLength}, chunk_size=${chunkSize}, total_chunk_count=${totalChunks}`);

  const body = isDirect
    ? {
        post_info: {
          title: (title || '').slice(0, 2200),
          privacy_level: effectivePrivacy,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: contentLength || 0,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks,
        },
      }
    : {
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: contentLength || 0,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks,
        },
      };

  const initRes = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });
  const initJson = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    console.error('❌ Error init FILE_UPLOAD TikTok:', initJson);
    const msg = initJson?.error?.message || 'Error inicializando FILE_UPLOAD en TikTok';
    throw new Error(msg);
  }
  const publishId = initJson?.data?.publish_id || null;
  const uploadUrl = initJson?.data?.upload_url || null;
  if (!publishId || !uploadUrl) {
    throw new Error('Respuesta init de TikTok no contiene publish_id o upload_url');
  }
  return { publishId, uploadUrl, videoSize: contentLength, chunkSize, totalChunks, contentType };
}

async function tiktokUploadFromUrl({ uploadUrl, videoUrl, videoSize, chunkSize, totalChunks, contentType }) {
  const videoResp = await fetch(videoUrl);
  if (!videoResp.ok || !videoResp.body) {
    throw new Error('No se pudo descargar el video de origen');
  }

  if (totalChunks === 1 || !videoSize) {
    // Subida simple en una sola petición
    const headers = { 'Content-Type': contentType || 'application/octet-stream' };
    if (videoSize) {
      headers['Content-Length'] = String(videoSize);
      headers['Content-Range'] = `bytes 0-${videoSize - 1}/${videoSize}`;
    }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: videoResp.body,
      duplex: 'half',
    });

    let putJson = {};
    try { putJson = await putRes.json(); } catch {}
    if (!putRes.ok) {
      console.error('❌ Error subiendo binario a TikTok:', putJson);
      const msg = putJson?.error?.message || 'Falló la subida de video a TikTok';
      throw new Error(msg);
    }
  } else {
    // Subida por chunks
    const videoBuffer = await videoResp.arrayBuffer();
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, videoSize);
      const chunk = videoBuffer.slice(start, end);
      
      const headers = {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${end - 1}/${videoSize}`,
      };

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers,
        body: chunk,
      });

      let putJson = {};
      try { putJson = await putRes.json(); } catch {}
      if (!putRes.ok) {
        console.error(`❌ Error subiendo chunk ${i + 1}/${totalChunks}:`, putJson);
        const msg = putJson?.error?.message || `Falló la subida del chunk ${i + 1}`;
        throw new Error(msg);
      }
    }
  }
}

async function refreshYouTubeAccessToken(supabase, userId, refreshToken) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET');
    }
    console.log('♻️ Refrescando token de YouTube...');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('❌ Error refrescando token de YouTube:', json);
      throw new Error(json.error_description || json.error || 'No se pudo refrescar token');
    }
    const newAccess = json.access_token;
    const expiresIn = json.expires_in || null;
    const newExpiresAt = expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString() : null;

    // Persistir en DB
    const { error: upError } = await supabase
      .from('profiles')
      .update({ youtube_access_token: newAccess, youtube_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (upError) {
      console.warn('⚠️ No se pudo actualizar el token de YouTube en DB:', upError.message || upError);
    }
    return { token: newAccess, expiresAt: newExpiresAt };
  } catch (e) {
    console.error('❌ Falló refresh de YouTube:', e?.message || e);
    return { token: null, expiresAt: null };
  }
}

export async function POST(request) {
  try {
    const { caption, imageUrl, videoUrl, platforms = ['instagram'], userId, privacyLevel } = await request.json();
    
    // Validar que se proporcione userId
    if (!userId) {
      return NextResponse.json({ error: 'Usuario no especificado' }, { status: 400 });
    }
    
    // Crear cliente de Supabase para el servidor
    console.log('🔧 Creando cliente Supabase para servidor...');
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Variables de Supabase no configuradas' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Cliente Supabase creado correctamente');
    const results = [];
    
    // Publicar en Instagram si está en las plataformas seleccionadas
    if (platforms.includes('instagram')) {
      try {
        // Obtener token de Instagram del usuario
        const { token, expiresAt, igUserId } = await getInstagramTokenServer(supabase, userId);
        
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
        console.log('🔗 URL:', `https://graph.facebook.com/v18.0/${igUserId}/media`);
        console.log('📋 Payload:', {
          [mediaType === 'IMAGE' ? 'image_url' : 'video_url']: mediaUrl,
          caption: caption || '',
          access_token: `${cleanToken.substring(0, 20)}...` // Solo mostrar inicio del token por seguridad
        });
        
        console.log('🔑 Usando PAGE_ACCESS_TOKEN para Instagram Business API');
        
        const containerResponse = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            [mediaType === 'IMAGE' ? 'image_url' : 'video_url']: mediaUrl,
            caption: caption || '',
            access_token: cleanToken,
          }),
        });
        
        console.log('📥 Respuesta de Instagram:', {
          status: containerResponse.status,
          statusText: containerResponse.statusText,
          ok: containerResponse.ok
        });
        
        const containerData = await containerResponse.json();
        console.log('📋 Datos de respuesta de Instagram:', containerData);
        
        if (!containerResponse.ok) {
          console.error('❌ Error de Instagram API:', containerData);
          const errorMsg = containerData.error?.message || containerData.error?.error_user_msg || 'Error creando container de media';
          const errorCode = containerData.error?.code || 'unknown';
          const errorType = containerData.error?.type || 'unknown';
          
          console.error('🔍 Detalles del error:', {
            message: errorMsg,
            code: errorCode,
            type: errorType,
            fullError: containerData.error
          });
          
          throw new Error(`Instagram API Error (${errorCode}): ${errorMsg}`);
        }
        
        const containerId = containerData.id;
        
        // Paso 2: Publicar el container
        const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media_publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: cleanToken,
          }),
        });
        
        const publishData = await publishResponse.json();
        
        if (!publishResponse.ok) {
          throw new Error(publishData.error?.message || 'Error publicando en Instagram');
        }
        
        results.push({
          platform: 'instagram',
          success: true,
          id: publishData.id,
          url: `https://www.instagram.com/p/${publishData.id}/`,
        });
        
      } catch (error) {
        console.error('Error publicando en Instagram:', error);
        results.push({
          platform: 'instagram',
          success: false,
          error: error.message,
        });
      }
    }
    
    // Publicar en Facebook si está en las plataformas seleccionadas
    if (platforms.includes('facebook')) {
      try {
        // Obtener token de Facebook del usuario
        const { token, expiresAt, pageId } = await getFacebookTokenServer(supabase, userId);
        
        if (!token) {
          throw new Error('No hay token de Facebook configurado');
        }
        
        if (!pageId) {
          throw new Error('No hay página de Facebook configurada');
        }
        
        // Verificar si el token ha expirado
        if (expiresAt && new Date(expiresAt) < new Date()) {
          throw new Error('Token de Facebook expirado');
        }
        
        console.log('📤 Publicando en Facebook página ID:', pageId);
        
        // Publicar usando Facebook Graph API con endpoints correctos
        let endpoint = '';
        const params = new URLSearchParams();
        const hasImage = !!imageUrl;
        const hasVideo = !!videoUrl;
        const message = caption || '';

        if (hasImage) {
          // Fotos: POST /{page-id}/photos con url y caption
          endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
          params.set('url', imageUrl);
          params.set('caption', message);
          params.set('access_token', token);
          params.set('published', 'true');
        } else if (hasVideo) {
          // Videos: POST /{page-id}/videos con file_url y description
          endpoint = `https://graph.facebook.com/v18.0/${pageId}/videos`;
          params.set('file_url', videoUrl);
          params.set('description', message);
          params.set('access_token', token);
          params.set('published', 'true');
        } else {
          // Solo texto: POST /{page-id}/feed con message
          endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
          params.set('message', message);
          params.set('access_token', token);
        }

        console.log('📋 Payload para Facebook:', {
          endpoint,
          hasMessage: !!message,
          hasImage,
          hasVideo,
          tokenStart: token.substring(0, 20) + '...'
        });

        const facebookResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        
        console.log('📥 Respuesta de Facebook:', {
          status: facebookResponse.status,
          statusText: facebookResponse.statusText,
          ok: facebookResponse.ok
        });
        
        const facebookData = await facebookResponse.json();
        console.log('📋 Datos de respuesta de Facebook:', facebookData);
        
        if (!facebookResponse.ok) {
          console.error('❌ Error de Facebook API:', facebookData);
          const errorMsg = facebookData.error?.message || 'Error publicando en Facebook';
          const errorCode = facebookData.error?.code || 'unknown';
          const errorType = facebookData.error?.type || 'unknown';
          
          console.error('🔍 Detalles del error Facebook:', {
            message: errorMsg,
            code: errorCode,
            type: errorType,
            fullError: facebookData.error
          });
          
          throw new Error(`Facebook API Error (${errorCode}): ${errorMsg}`);
        }
        
        results.push({
          platform: 'facebook',
          success: true,
          id: facebookData.post_id || facebookData.id,
          url: `https://www.facebook.com/${facebookData.post_id || facebookData.id}`,
        });
        
      } catch (error) {
        console.error('Error publicando en Facebook:', error);
        results.push({
          platform: 'facebook',
          success: false,
          error: error.message,
        });
      }
    }

    // NUEVO: Publicar en YouTube si está en las plataformas seleccionadas
    if (platforms.includes('youtube')) {
      try {
        if (!videoUrl) {
          throw new Error('YouTube requiere un video');
        }
        // Obtener token de YouTube
        const { token: ytToken, refreshToken: ytRefresh, expiresAt: ytExpiresAt } = await getYouTubeTokenServer(supabase, userId);
        if (!ytToken && !ytRefresh) {
          throw new Error('No hay token de YouTube configurado');
        }

        // Verificar expiración y refrescar si aplica
        let accessToken = ytToken || null;
        if (ytExpiresAt && new Date(ytExpiresAt) < new Date() && ytRefresh) {
          const refreshed = await refreshYouTubeAccessToken(supabase, userId, ytRefresh);
          if (!refreshed.token) throw new Error('Token de YouTube expirado y no se pudo refrescar');
          accessToken = refreshed.token;
        }
        if (!accessToken) {
          accessToken = ytToken; // puede ser válido aún
        }

        // Preparar metadatos
        const titleBase = (caption || 'Shorts').trim();
        const title = titleBase.substring(0, 95); // limitar un poco
        const description = caption || '';
        const contentType = videoUrl.toLowerCase().endsWith('.mp4') ? 'video/mp4' : (videoUrl.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/*');

        // Iniciar subida por sesión "resumable"
        const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': contentType,
          },
          body: JSON.stringify({
            snippet: { title, description },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
          }),
        });

        if (!initRes.ok) {
          const initErr = await initRes.json().catch(() => ({}));
          throw new Error(initErr.error?.message || 'No se pudo iniciar la subida a YouTube');
        }

        const uploadUrl = initRes.headers.get('location');
        if (!uploadUrl) {
          throw new Error('YouTube no devolvió URL de subida');
        }

        // Descargar el video desde videoUrl y retransmitirlo
        const videoResp = await fetch(videoUrl);
        if (!videoResp.ok) {
          throw new Error('No se pudo descargar el video de origen');
        }
        const totalLenHeader = videoResp.headers.get('content-length');
        const totalLen = totalLenHeader ? parseInt(totalLenHeader, 10) : null;

        const uploadHeaders = {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': contentType,
        };
        if (totalLen && Number.isFinite(totalLen)) {
          uploadHeaders['Content-Length'] = String(totalLen);
          uploadHeaders['Content-Range'] = `bytes 0-${totalLen - 1}/${totalLen}`;
        }

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: uploadHeaders,
          body: videoResp.body,
          // necesario para streams en Node (undici)
          duplex: 'half',
        });

        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          console.error('❌ Error subiendo a YouTube:', uploadJson);
          const msg = uploadJson.error?.message || 'Falló la subida de video a YouTube';
          throw new Error(msg);
        }

        const ytId = uploadJson?.id || null;
        if (!ytId) {
          throw new Error('Subida a YouTube completó sin ID de video');
        }

        results.push({
          platform: 'youtube',
          success: true,
          id: ytId,
          url: `https://www.youtube.com/watch?v=${ytId}`,
        });
      } catch (error) {
        console.error('Error publicando en YouTube:', error);
        results.push({
          platform: 'youtube',
          success: false,
          error: error.message,
        });
      }
    }

    // NUEVO: Publicar en TikTok si está en las plataformas seleccionadas
    if (platforms.includes('tiktok')) {
      try {
        if (!videoUrl) {
          throw new Error('TikTok requiere un video');
        }
        // Obtener token de TikTok
        const { token: ttToken, expiresAt: ttExpiresAt, openId, grantedScopes } = await getTikTokTokenServer(supabase, userId);
        if (!ttToken) {
          throw new Error('No hay token de TikTok configurado');
        }
        // Verificar expiración
        if (ttExpiresAt && new Date(ttExpiresAt) < new Date()) {
          throw new Error('Token de TikTok expirado');
        }

        // Normalizar scopes
        const scopes = Array.isArray(grantedScopes)
          ? grantedScopes
          : (typeof grantedScopes === 'string' ? grantedScopes.split(/[\s,]+/).filter(Boolean) : []);
        const hasDirectPost = scopes.includes('video.publish');
        const hasUpload = scopes.includes('video.upload');
        
        console.log('🔑 TikTok scopes disponibles:', scopes);
        console.log('📋 Permisos: video.publish =', hasDirectPost, ', video.upload =', hasUpload);

        let publishId = null;
        let status = null;

        // Usar dominio verificado cuando sea Cloudinary
        const pullUrl = normalizeVerifiedTikTokUrl(videoUrl);
        console.log('🔗 URL normalizada para TikTok (PULL_FROM_URL):', pullUrl);

        if (hasDirectPost) {
          console.log('📤 Publicando en TikTok (Direct Post)...');
          // Obtener creator_info para validar privacidad y capacidad de posteo
          let creatorInfo = null;
          try {
            const ciRes = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${ttToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
              },
            });
            creatorInfo = await ciRes.json().catch(() => ({}));
          } catch (e) {
            console.warn('⚠️ creator_info/query falló o no está disponible, se continúa de todas formas');
          }

          // Derivar privacy: por defecto SELF_ONLY (requisito para clientes no auditados)
          const options = creatorInfo?.data?.privacy_level_options;
          let effectivePrivacy = 'SELF_ONLY';
          if (privacyLevel && Array.isArray(options) && options.includes(privacyLevel)) {
            effectivePrivacy = privacyLevel;
          }
          console.log('👤 TikTok creator_info privacy options:', options, '-> usando:', effectivePrivacy);

          const title = (caption || '').slice(0, 2200);
          const initBody = {
            post_info: {
              title,
              privacy_level: effectivePrivacy,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: pullUrl,
            },
          };

          const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ttToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify(initBody),
          });
          const initJson = await initRes.json().catch(() => ({}));

          if (!initRes.ok) {
            const errMsg = initJson?.error?.message || '';
            console.warn('⚠️ PULL_FROM_URL falló, evaluando fallback FILE_UPLOAD...', errMsg);
            if (/URL ownership|ownership verification|pull_from_url|guidelines/i.test(errMsg)) {
              try {
                const { publishId: upId, uploadUrl, videoSize, chunkSize, totalChunks, contentType } = await tiktokInitFileUpload({ token: ttToken, mode: 'direct', title, privacyLevel: effectivePrivacy, videoUrl });
                await tiktokUploadFromUrl({ uploadUrl, videoUrl, videoSize, chunkSize, totalChunks, contentType });
                publishId = upId;
              } catch (e) {
                if (hasUpload) {
                  console.warn('⚠️ Direct FILE_UPLOAD falló, intentando Inbox FILE_UPLOAD...', e?.message || e);
                  const { publishId: upId, uploadUrl, videoSize, chunkSize, totalChunks, contentType } = await tiktokInitFileUpload({ token: ttToken, mode: 'inbox', videoUrl });
                  await tiktokUploadFromUrl({ uploadUrl, videoUrl, videoSize, chunkSize, totalChunks, contentType });
                  publishId = upId;
                } else {
                  throw e;
                }
              }
            } else {
              if (hasUpload) {
                console.warn('⚠️ Intentando Inbox FILE_UPLOAD como último recurso...');
                const { publishId: upId, uploadUrl, videoSize, chunkSize, totalChunks, contentType } = await tiktokInitFileUpload({ token: ttToken, mode: 'inbox', videoUrl });
                await tiktokUploadFromUrl({ uploadUrl, videoUrl, videoSize, chunkSize, totalChunks, contentType });
                publishId = upId;
              } else {
                throw new Error(errMsg || 'Error inicializando publicación en TikTok (Direct Post)');
              }
            }
          } else {
            publishId = initJson?.data?.publish_id || null;
          }
        } else if (hasUpload) {
          console.log('📤 Enviando a TikTok Inbox (Upload)...');
          const initBody = {
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: pullUrl,
            },
          };
          const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ttToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(initBody),
          });
          const initJson = await initRes.json().catch(() => ({}));
          if (!initRes.ok) {
            const errMsg = initJson?.error?.message || '';
            console.error('❌ Error init TikTok (Inbox):', initJson);
            console.warn('⚠️ PULL_FROM_URL (Inbox) falló, intentando FILE_UPLOAD...', errMsg);
            if (/URL ownership|ownership verification|pull_from_url|guidelines/i.test(errMsg)) {
              // Fallback a FILE_UPLOAD
            const { publishId: upId, uploadUrl, videoSize, chunkSize, totalChunks, contentType } = await tiktokInitFileUpload({ token: ttToken, mode: 'inbox', videoUrl });
            await tiktokUploadFromUrl({ uploadUrl, videoUrl, videoSize, chunkSize, totalChunks, contentType });
            publishId = upId;
            } else {
              throw new Error(errMsg || 'Error subiendo video a TikTok (Inbox)');
            }
          } else {
            publishId = initJson?.data?.publish_id || null;
          }
        } else {
          throw new Error('Permisos de TikTok insuficientes (requiere video.publish o video.upload)');
        }

        // Consultar estado inicial (opcional)
        if (publishId) {
          try {
            const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${ttToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
              },
              body: JSON.stringify({ publish_id: publishId }),
            });
            const statusJson = await statusRes.json().catch(() => ({}));
            if (statusRes.ok) {
              status = statusJson?.data?.status || null;
            }
          } catch (e) {
            console.warn('⚠️ No se pudo obtener estado inicial de TikTok:', e?.message || e);
          }
        }

        results.push({
          platform: 'tiktok',
          success: true,
          id: publishId,
          status,
        });
      } catch (error) {
        console.error('Error publicando en TikTok:', error);
        results.push({
          platform: 'tiktok',
          success: false,
          error: error.message,
        });
      }
    }

    // Determinar el estado general
    const hasSuccess = results.some(r => r.success);
    const hasErrors = results.some(r => !r.success);
    
    return NextResponse.json({
      success: hasSuccess,
      results,
      message: hasSuccess 
        ? (hasErrors ? 'Publicado parcialmente' : 'Publicado exitosamente')
        : 'Error en la publicación'
    });
    
  } catch (error) {
    console.error('Error en /api/publish:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}