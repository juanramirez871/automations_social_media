import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { getSupabaseClient } from '@/lib/supabaseUniversal';

/**
 * Obtiene la configuración de IA del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<{provider: string, apiKey: string, model: object}>}
 */
export async function getUserAIConfig(userId) {
  try {
    console.log('🔍 getUserAIConfig - userId:', userId);
    const supabase = getSupabaseClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('ai_model, ai_api_key')
      .eq('id', userId)
      .single();

    console.log('📊 getUserAIConfig - profile data:', {
      hasProfile: !!profile,
      hasModel: !!profile?.ai_model,
      hasApiKey: !!profile?.ai_api_key,
      model: profile?.ai_model,
      apiKeyLength: profile?.ai_api_key?.length || 0,
      apiKey: profile?.ai_api_key,
      error: error?.message
    });

    if (error || !profile || !profile.ai_api_key) {
      console.log('❌ getUserAIConfig - Configuración incompleta, lanzando AI_CONFIG_REQUIRED');
      // Si no hay configuración, lanzar error para mostrar widget de configuración
      throw new Error('AI_CONFIG_REQUIRED');
    }

    const inferProviderFromKey = key => {
      if (typeof key !== 'string') return null;
      if (key.startsWith('sk-')) return 'openai';
      if (key.startsWith('AIza')) return 'gemini';
      return null;
    };

    const provider = profile?.ai_model || inferProviderFromKey(profile?.ai_api_key) || 'gemini';
    const userApiKey = profile?.ai_api_key;

    console.log('✅ getUserAIConfig - Configuración válida encontrada:', {
      provider,
      apiKeyLength: userApiKey.length
    });

    return getAIModel(provider, userApiKey);
  } catch (error) {
    if (error.message === 'AI_CONFIG_REQUIRED') {
      throw error; // Re-lanzar para manejo específico
    }
    console.error('❌ Error getting user AI config:', error);
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
      const openaiProvider = createOpenAI({
        apiKey: userApiKey,
      });

      return {
        provider: 'openai',
        apiKey: userApiKey,
        model: openaiProvider('gpt-4o-mini'),
      };

    case 'gemini':
    default:
      console.log("🔑 Configurando Google provider con API key:", {
        hasApiKey: !!userApiKey,
        apiKeyLength: userApiKey?.length || 0,
        apiKeyPrefix: userApiKey?.substring(0, 8) + '...'
      });
      
      // Crear instancia personalizada del provider de Google con la API key del usuario
      const googleProvider = createGoogleGenerativeAI({
        apiKey: userApiKey,
      });
      
      return {
        provider: 'gemini',
        apiKey: userApiKey,
        model: googleProvider('gemini-2.5-flash'),
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

    const supabase = getSupabaseClient();

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
