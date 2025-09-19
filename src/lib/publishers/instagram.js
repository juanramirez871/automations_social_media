import { getSupabaseClient } from '@/lib/supabaseUniversal';
import { getValidInstagramToken } from './instagramRefresh';

export async function getInstagramToken(userId) {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    console.error('❌ Supabase client no está disponible');
    return null;
  }

  console.log(userId)
  const { data, error } = await supabase
    .from('profiles')
    .select('instagram_access_token, instagram_expires_at, instagram_user_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching Instagram token:', error);
    return null;
  }
  console.log(data, "userInfo")
  return {
    token: data?.instagram_access_token,
    expires_at: data?.instagram_expires_at,
    user_id: data?.instagram_user_id,
  };
}

export async function publishToInstagram({ userId, imageUrl, videoUrl, caption }) {
  try {
    // Usar imageUrl o videoUrl como mediaUrl
    const mediaUrl = imageUrl || videoUrl;
    
    // Usar la función original getInstagramToken en lugar del refresh automático
    const userInfo = await getInstagramToken(userId);
    const token = userInfo?.token;
    const igUserId = userInfo?.user_id;
    if (!token) {
      throw new Error('No se encontró token de Instagram');
    }

    if (!igUserId) {
      throw new Error('No se encontró el ID de usuario de Instagram');
    }

    // Limpiar el token (remover espacios en blanco)
    const cleanToken = token.trim();

    // Verificar que la URL del media sea válida
    console.log(mediaUrl, "media")
    if (!mediaUrl || !mediaUrl.startsWith('http')) {
      throw new Error('URL del media inválida');
    }

    console.log('📸 Iniciando publicación en Instagram...');

    // Paso 1: Crear contenedor de media
    const containerUrl = `https://graph.facebook.com/v18.0/${igUserId}/media`;
    const containerParams = new URLSearchParams({
      image_url: mediaUrl,
      caption: caption || '',
      access_token: cleanToken,
    });

    const containerResponse = await fetch(containerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: containerParams,
    });

    const containerData = await containerResponse.json();

    if (!containerResponse.ok) {
      console.error('❌ Error creando contenedor de media:', containerData);
      
      // Verificar si es un error de token expirado
      if (containerData.error?.code === 190 || 
          containerData.error?.message?.toLowerCase().includes('expired') ||
          containerData.error?.message?.toLowerCase().includes('invalid')) {
        throw new Error('INSTAGRAM_TOKEN_EXPIRED');
      }
      
      throw new Error(
        containerData.error?.message || 
        containerData.error || 
        'Error creando contenedor de media en Instagram'
      );
    }

    const creationId = containerData.id;
    console.log('✅ Contenedor de media creado:', creationId);

    // Paso 2: Publicar el media
    const publishUrl = `https://graph.facebook.com/v18.0/${igUserId}/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: cleanToken,
    });

    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams,
    });

    const publishData = await publishResponse.json();

    if (!publishResponse.ok) {
      console.error('❌ Error publicando media:', publishData);
      
      // Verificar si es un error de token expirado
      if (publishData.error?.code === 190 || 
          publishData.error?.message?.toLowerCase().includes('expired') ||
          publishData.error?.message?.toLowerCase().includes('invalid')) {
        throw new Error('INSTAGRAM_TOKEN_EXPIRED');
      }
      
      throw new Error(
        publishData.error?.message || 
        publishData.error || 
        'Error publicando media en Instagram'
      );
    }

    console.log('✅ Media publicado exitosamente en Instagram:', publishData.id);
    
    return {
      success: true,
      postId: publishData.id,
      message: 'Publicado exitosamente en Instagram',
    };
  } catch (error) {
    console.error('❌ Error en publishToInstagram:', error);
    
    return {
      success: false,
      error: error.message,
    };
  }
}
