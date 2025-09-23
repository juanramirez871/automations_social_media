import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Función para publicar en Instagram
async function publishToInstagram(content, accessToken, userId) {
  try {
    // Implementar lógica de publicación en Instagram
    // Esta es una implementación básica, necesitarás ajustarla según tu configuración
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${userId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption: content,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    return { success: response.ok, data, error: data.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Función para publicar en Facebook
async function publishToFacebook(content, accessToken, pageId, userId) {
  try {
    // Limpiar el token de cualquier espacio o caracteres especiales
    const cleanToken = accessToken
      .trim()
      .replace(/\s+/g, '')
      .replace(/[\r\n\t]/g, '');

    // Usar la versión más reciente de la API de Facebook
    const endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
    
    const postData = {
      message: content || '',
      access_token: cleanToken,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || 'Error publicando en Facebook';
      
      // Detectar errores específicos de token expirado
      if (data?.error?.code === 190 || 
          data?.error?.message?.includes('expired') ||
          data?.error?.message?.includes('revoked')) {
        throw new Error('El token de Facebook ha expirado. Necesitas reconectar tu cuenta de Facebook para continuar publicando.');
      }
      
      // Detectar específicamente el error de publish_actions deprecado
      // Solo limpiar si es realmente un error de permisos deprecados, no cualquier mención
      if ((data?.error?.message?.includes('publish_actions is deprecated') ||
           data?.error?.message?.includes('publish_actions has been deprecated')) &&
          data?.error?.code === 200) {
        
        console.log('🧹 Detectado token con permisos deprecados (publish_actions), limpiando de la base de datos...');
        
        // Limpiar el token inválido de la base de datos
        try {
          const { error: cleanupError } = await supabase
            .from('profiles')
            .update({
              facebook_access_token: null,
              facebook_token_expires_at: null,
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

    return { 
      success: true, 
      data: {
        id: data.id || data.post_id,
        url: `https://www.facebook.com/${data.id || data.post_id}`
      }, 
      error: null 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Función para publicar en YouTube (como comentario o descripción)
async function publishToYouTube(content, accessToken) {
  try {
    // Para YouTube necesitarías subir un video o crear una publicación en la comunidad
    // Esta es una implementación simplificada
    console.log('YouTube publication not fully implemented:', content);

    return {
      success: true,
      data: { message: 'YouTube publication simulated' },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Función para publicar en TikTok
async function publishToTikTok(content, accessToken) {
  try {
    // TikTok requiere subir un video, esta es una implementación simplificada
    console.log('TikTok publication not fully implemented:', content);

    return { success: true, data: { message: 'TikTok publication simulated' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Función principal para publicar en una plataforma
async function publishToPlatform(platform, content, userProfile, userId) {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return await publishToInstagram(
        content,
        userProfile.instagram_access_token,
        userProfile.instagram_user_id
      );

    case 'facebook':
      return await publishToFacebook(
        content,
        userProfile.facebook_access_token,
        userProfile.facebook_page_id,
        userId
      );

    case 'youtube':
      return await publishToYouTube(content, userProfile.youtube_access_token);

    case 'tiktok':
      return await publishToTikTok(content, userProfile.tiktok_access_token);

    default:
      return { success: false, error: `Platform ${platform} not supported` };
  }
}

// POST - Ejecutar publicaciones programadas
export async function POST(request) {
  try {
    // Verificar autenticación (opcional: usar un token de servicio)
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener publicaciones que deben ejecutarse ahora
    const now = new Date();
    const { data: postsToExecute, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_datetime', now.toISOString());

    if (fetchError) {
      console.error('Error fetching posts to execute:', fetchError);

      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      );
    }

    // Obtener perfiles de usuario para cada post
    const postsWithProfiles = [];

    for (const post of postsToExecute || []) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          `
          instagram_access_token,
          instagram_user_id,
          facebook_access_token,
          facebook_page_id,
          youtube_access_token,
          tiktok_access_token
        `
        )
        .eq('id', post.user_id)
        .single();

      if (profile) {
        postsWithProfiles.push({ ...post, profiles: profile });
      }
    }

    const finalPostsToExecute = postsWithProfiles;
    const results = [];

    // Procesar cada publicación
    for (const post of finalPostsToExecute) {
      try {
        // Marcar como ejecutándose
        await supabase
          .from('scheduled_posts')
          .update({ status: 'executing' })
          .eq('id', post.id);

        const platformResults = {};
        let hasErrors = false;

        // Publicar en cada plataforma
        for (const platform of post.platforms) {
          const result = await publishToPlatform(
            platform,
            post.content,
            post.profiles,
            post.user_id
          );

          platformResults[platform] = result;

          if (!result.success) {
            hasErrors = true;
          }
        }

        // Actualizar estado final
        const finalStatus = hasErrors ? 'failed' : 'completed';
        const updateData = {
          status: finalStatus,
          executed_at: new Date().toISOString(),
          platform_results: platformResults,
        };

        if (hasErrors) {
          updateData.retry_count = (post.retry_count || 0) + 1;
          updateData.error_message = 'Some platforms failed to publish';

          // Si no ha excedido el máximo de reintentos, programar para reintento
          if (updateData.retry_count < post.max_retries) {
            updateData.status = 'pending';
            // Programar reintento en 5 minutos
            const retryTime = new Date(Date.now() + 5 * 60 * 1000);

            updateData.scheduled_datetime = retryTime.toISOString();
          }
        }

        await supabase
          .from('scheduled_posts')
          .update(updateData)
          .eq('id', post.id);

        results.push({
          postId: post.id,
          status: finalStatus,
          platforms: platformResults,
        });
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);

        // Marcar como fallido
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            executed_at: new Date().toISOString(),
            error_message: error.message,
            retry_count: (post.retry_count || 0) + 1,
          })
          .eq('id', post.id);

        results.push({
          postId: post.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${finalPostsToExecute.length} scheduled posts`,
      results,
    });
  } catch (error) {
    console.error('Error in POST /api/execute-scheduled-posts:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Obtener estadísticas de ejecución
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Obtener estadísticas
    const { data: stats, error } = await supabase
      .from('scheduled_posts')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching stats:', error);

      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      );
    }

    const statusCounts = stats.reduce((acc, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1;

      return acc;
    }, {});

    return NextResponse.json({ stats: statusCounts });
  } catch (error) {
    console.error('Error in GET /api/execute-scheduled-posts:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
