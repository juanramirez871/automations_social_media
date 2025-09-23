import { getValidFacebookToken } from './facebookRefresh.js';

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
    // Usar el nuevo sistema de refresh automático de tokens
    const { token, pageId, pageName } = await getValidFacebookToken(supabase, userId);

    if (!token) {
      throw new Error('No hay token de Facebook configurado');
    }

    if (!pageId) {
      throw new Error('No hay página de Facebook configurada');
    }

    const cleanToken = token
      .trim()
      .replace(/\s+/g, '')
      .replace(/[\r\n\t]/g, '');

    // Construir endpoint y datos según el tipo de contenido
    // IMPORTANTE: Usar /feed para todos los tipos de contenido con pages_manage_posts
    // El endpoint /photos requiere publish_actions que está deprecado
    let postData;
    let endpoint;

    if (imageUrl || videoUrl) {
      const mediaUrl = imageUrl || videoUrl;
      
      if (imageUrl) {
        // Para fotos, usar /feed con link en lugar de /photos
        // Esto funciona con pages_manage_posts sin requerir publish_actions
        endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
        postData = {
          message: caption || '',
          link: mediaUrl,
          access_token: cleanToken,
        };
      } else {
        // Para videos, usar el endpoint de videos
        endpoint = `https://graph.facebook.com/v21.0/${pageId}/videos`;
        postData = {
          file_url: mediaUrl,
          description: caption || '',
          access_token: cleanToken,
        };
      }
    } else {
      endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
      postData = {
        message: caption || '',
        access_token: cleanToken,
      };
    }

    console.log('📤 Publicando en Facebook...');
    console.log('🔗 Endpoint:', endpoint);
    console.log('📋 Datos:', { ...postData, access_token: '[HIDDEN]' });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    const responseData = await response.json();
    
    console.log('📥 Respuesta de Facebook:', responseData);
    console.log('📊 Status:', response.status);

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || 'Error publicando en Facebook';
      
      console.log('❌ Error de Facebook:', {
        code: responseData?.error?.code,
        message: responseData?.error?.message,
        type: responseData?.error?.type,
        error_subcode: responseData?.error?.error_subcode
      });
      
      // Detectar errores específicos de token expirado
      if (responseData?.error?.code === 190 || 
          responseData?.error?.message?.includes('expired') ||
          responseData?.error?.message?.includes('revoked')) {
        throw new Error('El token de Facebook ha expirado. Necesitas reconectar tu cuenta de Facebook para continuar publicando.');
      }

      // Detectar específicamente el error de publish_actions deprecado
      // Solo limpiar si es realmente un error de permisos deprecados, no cualquier mención
      if ((responseData?.error?.message?.includes('publish_actions is deprecated') ||
           responseData?.error?.message?.includes('publish_actions has been deprecated')) &&
          responseData?.error?.code === 200) {
        
        console.log('🧹 Detectado token con permisos deprecados (publish_actions), limpiando de la base de datos...');
        
        // Limpiar el token inválido de la base de datos
        try {
          const { error: cleanupError } = await supabase
            .from('profiles')
            .update({
              facebook_access_token: null,
              facebook_expires_at: null,
              facebook_granted_scopes: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (cleanupError) {
            console.error('❌ Error limpiando token de Facebook:', cleanupError);
          } else {
            console.log('✅ Token de Facebook con permisos deprecados eliminado de la base de datos');
          }
        } catch (cleanupErr) {
          console.error('❌ Error en limpieza de token:', cleanupErr);
        }
        
        throw new Error('El token de Facebook usa permisos deprecados (publish_actions). Necesitas reconectar tu cuenta de Facebook con los nuevos permisos para continuar publicando.');
      }

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
