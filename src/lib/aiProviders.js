import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { createServerClient } from '@/lib/supabaseServer';

/**
 * Obtiene la configuración de IA del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<{provider: string, apiKey: string, model: object}>}
 */
export async function getUserAIConfig(userId) {
  try {
    const supabase = createServerClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('ai_model, ai_api_key')
      .eq('id', userId)
      .single();

    if (error || !profile || !profile.ai_model || !profile.ai_api_key) {
      // Si no hay configuración, lanzar error para mostrar widget de configuración
      throw new Error('AI_CONFIG_REQUIRED');
    }

    const provider = profile.ai_model;
    const userApiKey = profile.ai_api_key;

    return getAIModel(provider, userApiKey);
  } catch (error) {
    if (error.message === 'AI_CONFIG_REQUIRED') {
      throw error; // Re-lanzar para manejo específico
    }
    console.error('Error getting user AI config:', error);
    throw new Error('AI_CONFIG_ERROR');
  }
}

/**
 * Crea el modelo de IA según el proveedor
 * @param {string} provider - Proveedor de IA ('gemini', 'openai')
 * @param {string} userApiKey - API key del usuario (requerido)
 * @returns {object} Configuración del modelo
 */
export function getAIModel(provider, userApiKey) {
  if (!userApiKey) {
    throw new Error('API key is required');
  }

  switch (provider) {
    case 'openai':
      return {
        provider: 'openai',
        apiKey: userApiKey,
        model: openai('gpt-4o-mini', {
          apiKey: userApiKey,
        }),
      };

    case 'gemini':
    default:
      return {
        provider: 'gemini',
        apiKey: userApiKey,
        model: google('gemini-2.5-flash', {
          apiKey: userApiKey,
        }),
      };
  }
}

/**
 * Obtiene el modelo de IA para un usuario específico
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Modelo de IA configurado
 */
export async function getModelForUser(userId) {
  if (!userId) {
    throw new Error('AI_CONFIG_REQUIRED');
  }

  const config = await getUserAIConfig(userId);

  return config.model;
}

/**
 * Actualiza la configuración de IA del usuario
 * @param {string} userId - ID del usuario
 * @param {string} provider - Proveedor de IA
 * @param {string} apiKey - API key (requerido)
 * @returns {Promise<boolean>} Éxito de la operación
 */
export async function updateUserAIConfig(userId, provider, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    const supabase = createServerClient();

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      ai_model: provider,
      ai_api_key: apiKey,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error updating AI config:', error);

      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating user AI config:', error);

    return false;
  }
}

/**
 * Obtiene la lista de proveedores disponibles
 * @returns {Array} Lista de proveedores
 */
export function getAvailableProviders() {
  return [
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Modelo avanzado de Google AI',
      requiresApiKey: true,
      defaultModel: 'gemini-2.5-flash',
      icon: '🤖',
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      description: 'GPT-4o Mini, rápido y eficiente',
      requiresApiKey: true,
      defaultModel: 'gpt-4o-mini',
      icon: '🧠',
    },
  ];
}
