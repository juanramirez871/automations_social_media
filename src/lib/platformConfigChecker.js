import { getSupabaseClient } from '@/lib/supabaseUniversal';
import { getInstagramToken } from '@/lib/publishers/instagram';
import { getValidInstagramToken } from '@/lib/publishers/instagramRefresh';

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
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      console.error('❌ Supabase client no está disponible');
      return { configured: false, error: 'Cliente de Supabase no disponible' };
    }

    const token = await getInstagramToken(userId);

    if (!token?.token) {
      return {
        error: 'No hay token de Instagram configurado. Necesitas conectar tu cuenta de Instagram para poder publicar en esta plataforma.'
      };
    }

    // Verificar si el token está expirado
    if (token.expires_at) {
      const now = new Date();
      const expiration = new Date(token.expires_at);
      
      if (expiration <= now) {
        return {
          error: 'El token de Instagram ha expirado. Necesitas reconectar tu cuenta de Instagram.',
          type: 'token_expired'
        };
      }
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
export async function checkFacebookConfiguration(userId) {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      console.error('❌ Supabase client no está disponible');
      return { configured: false, error: 'Cliente de Supabase no disponible' };
    }

    const tokenResult = await getValidFacebookToken(userId);
    const { token, pageId, pageName } = tokenResult;

    if (!token) {
      return {
        error: 'No hay token de Facebook configurado. Necesitas conectar tu cuenta de Facebook para poder publicar en esta plataforma.'
      };
    }

    if (!pageId) {
      return {
        error: 'No hay página de Facebook configurada. Necesitas seleccionar una página de Facebook para publicar.'
      };
    }

    return { success: true };
  } catch (e) {
    // Manejar errores específicos de token expirado
    if (e.message.includes('El token de Facebook ha expirado')) {
      return {
        error: 'El token de Facebook ha expirado. Necesitas reconectar tu cuenta de Facebook.'
      };
    }
    
    if (e.message.includes('Session expirada de Facebook')) {
      return {
        error: 'No hay token de Facebook configurado. Necesitas conectar tu cuenta de Facebook para poder publicar en esta plataforma.'
      };
    }
    
    // Detectar errores de permisos deprecados (publish_actions)
    if (e.message.includes('permisos deprecados') || 
        e.message.includes('publish_actions') ||
        e.message.includes('nuevos permisos requeridos')) {
      return {
        error: 'Tu token de Facebook fue generado con permisos deprecados. Necesitas reconectar tu cuenta de Facebook para obtener los nuevos permisos requeridos.'
      };
    }
    
    return {
      error: `Error verificando configuración de Facebook: ${e.message}`
    };
  }
}

import { getValidFacebookToken } from './publishers/facebookRefresh.js';

/**
 * Verifica la configuración de YouTube para el usuario
 */
async function checkYouTubeConfiguration(userId) {
  try {
    // Usar la nueva función que maneja automáticamente el refresh
    const { token, refreshToken, expiresAt, channelId } = await getValidYouTubeToken(supabase, userId);

    if (!token) {
      return {
        error: 'Session expirada de youtube. Necesitas conectar tu cuenta de YouTube para poder publicar en esta plataforma.'
      };
    }

    if (!channelId) {
      return {
        error: 'No hay canal de YouTube configurado. Necesitas tener un canal de YouTube para publicar.'
      };
    }

    return { success: true };
  } catch (e) {
    // Si el error es por token expirado sin refresh token, dar un mensaje específico
    if (e.message.includes('refresh token disponible')) {
      return {
        error: 'El token de YouTube ha expirado y no hay refresh token disponible. Necesitas reconectar tu cuenta de YouTube.'
      };
    }
    
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

  // Verificar si hay errores específicos de Facebook que requieren reconexión
  const facebookTokenError = errors.find(err => 
    err.platform === 'Facebook' && 
    (err.error.includes('expirado') || 
     err.error.includes('expired') || 
     err.error.includes('reconectar') ||
     err.error.includes('permisos deprecados') ||
     err.error.includes('publish_actions') ||
     err.error.includes('nuevos permisos requeridos'))
  );

  if (facebookTokenError) {
    // Si hay un error de token expirado de Facebook, mostrar widget de reconexión
    return {
      id: `config-error-${Date.now()}`,
      role: 'assistant',
      type: 'widget-facebook-reconnect',
      content: `⚠️ **Token de Facebook expirado**\n\n${facebookTokenError.error}\n\nHaz clic en el botón de abajo para reconectar tu cuenta de Facebook.`
    };
  }

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