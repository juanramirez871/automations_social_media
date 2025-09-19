import { supabase } from '@/lib/supabaseClient';
import { getInstagramToken } from '@/lib/publishers/instagram';

/**
 * Verifica el estado de configuración de plataformas específicas
 * y retorna errores de configuración que deben mostrarse al usuario
 */
export async function checkPlatformConfiguration(userId, platforms = ['instagram', 'facebook', 'youtube', 'tiktok']) {
  const errors = [];
  
  try {
    // Verificar solo las plataformas especificadas
    if (platforms.includes('instagram')) {
      const instagramResult = await checkInstagramConfiguration(userId);
      if (instagramResult.error) {
        errors.push({
          platform: 'Instagram',
          error: instagramResult.error,
          type: 'configuration'
        });
      }
    }

    // Aquí se pueden agregar verificaciones para otras plataformas
    // if (platforms.includes('facebook')) {
    //   const facebookResult = await checkFacebookConfiguration(userId);
    //   if (facebookResult.error) {
    //     errors.push({
    //       platform: 'Facebook',
    //       error: facebookResult.error,
    //       type: 'configuration'
    //     });
    //   }
    // }

  } catch (e) {
    console.error('Error verificando configuración de plataformas:', e);
  }

  return errors;
}

/**
 * Verifica la configuración de Instagram para el usuario
 */
async function checkInstagramConfiguration(userId) {
  try {
    const { token, expiresAt } = await getInstagramToken(supabase, userId);

    if (!token) {
      return {
        error: 'No hay token de Instagram configurado. Necesitas conectar tu cuenta de Instagram para poder publicar en esta plataforma.'
      };
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
      return {
        error: 'El token de Instagram ha expirado. Necesitas reconectar tu cuenta de Instagram.'
      };
    }

    return { success: true };
  } catch (e) {
    return {
      error: `Error verificando configuración de Instagram: ${e.message}`
    };
  }
}

/**
 * Verifica la configuración de Facebook para el usuario
 */
async function checkFacebookConfiguration(userId) {
  try {
    const { token, expiresAt, pageId } = await getFacebookToken(supabase, userId);

    if (!token) {
      return {
        error: 'No hay token de Facebook configurado. Necesitas conectar tu cuenta de Facebook para poder publicar en esta plataforma.'
      };
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
      return {
        error: 'El token de Facebook ha expirado. Necesitas reconectar tu cuenta de Facebook.'
      };
    }

    if (!pageId) {
      return {
        error: 'No hay página de Facebook configurada. Necesitas seleccionar una página de Facebook para publicar.'
      };
    }

    return { success: true };
  } catch (e) {
    return {
      error: `Error verificando configuración de Facebook: ${e.message}`
    };
  }
}

/**
 * Verifica la configuración de YouTube para el usuario
 */
async function checkYouTubeConfiguration(userId) {
  try {
    const { token, refreshToken, expiresAt, channelId } = await getYouTubeToken(supabase, userId);

    if (!token) {
      return {
        error: 'No hay token de YouTube configurado. Necesitas conectar tu cuenta de YouTube para poder publicar en esta plataforma.'
      };
    }

    if (expiresAt && new Date(expiresAt) < new Date() && !refreshToken) {
      return {
        error: 'El token de YouTube ha expirado y no hay refresh token disponible. Necesitas reconectar tu cuenta de YouTube.'
      };
    }

    if (!channelId) {
      return {
        error: 'No hay canal de YouTube configurado. Necesitas tener un canal de YouTube para publicar.'
      };
    }

    return { success: true };
  } catch (e) {
    return {
      error: `Error verificando configuración de YouTube: ${e.message}`
    };
  }
}

/**
 * Verifica la configuración de TikTok para el usuario
 */
async function checkTikTokConfiguration(userId) {
  try {
    const { token, expiresAt, openId } = await getTikTokToken(supabase, userId);

    if (!token) {
      return {
        error: 'No hay token de TikTok configurado. Necesitas conectar tu cuenta de TikTok para poder publicar en esta plataforma.'
      };
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
      return {
        error: 'El token de TikTok ha expirado. Necesitas reconectar tu cuenta de TikTok.'
      };
    }

    if (!openId) {
      return {
        error: 'No hay ID de usuario de TikTok configurado. Necesitas completar la configuración de TikTok.'
      };
    }

    return { success: true };
  } catch (e) {
    return {
      error: `Error verificando configuración de TikTok: ${e.message}`
    };
  }
}

/**
 * Genera un mensaje de chat con los errores de configuración encontrados
 */
export function createConfigurationErrorMessage(errors) {
  if (errors.length === 0) return null;

  const errorList = errors.map(err => `• **${err.platform}**: ${err.error}`).join('\n');
  
  return {
    id: `config-error-${Date.now()}`,
    role: 'assistant',
    type: 'text',
    content: `⚠️ **Problemas de configuración detectados:**\n\n${errorList}\n\nPor favor, configura estas plataformas antes de intentar publicar.`
  };
}

/**
 * Verifica si el usuario tiene al menos una plataforma configurada correctamente
 */
export async function hasValidPlatformConfiguration(userId) {
  try {
    const { token: igToken, expiresAt: igExpires } = await getInstagramToken(supabase, userId);
    
    // Instagram válido
    if (igToken && (!igExpires || new Date(igExpires) > new Date())) {
      return true;
    }

    // Aquí se pueden agregar verificaciones para otras plataformas
    // const fbValid = await checkFacebookValid(userId);
    // const ytValid = await checkYouTubeValid(userId);
    // etc.

    return false;
  } catch (e) {
    console.error('Error verificando plataformas válidas:', e);
    return false;
  }
}