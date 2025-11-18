import { google } from '@ai-sdk/google';
import { generateText, convertToModelMessages, tool } from 'ai';
import { getModelForUser, getUserAIConfig } from '@/lib/aiProviders';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const payload = await req.json();
    const { messages, mode, prompt, userId } = payload || {};
    
    console.log('🚀 Chat API - Iniciando request:', {
      userId,
      hasMessages: !!messages,
      messagesCount: messages?.length || 0
    });

    // Obtener el modelo de IA configurado para el usuario
    let userModel;

    try {
      console.log('🔍 Chat API - Obteniendo modelo para usuario:', userId);
      userModel = await getModelForUser(userId);
      console.log('✅ Chat API - Modelo obtenido exitosamente');
      console.log('🔍 Debug userModel:', {
        provider: userModel?.config?.provider,
        modelId: userModel?.modelId,
        type: typeof userModel,
        constructor: userModel?.constructor?.name,
        keys: Object.keys(userModel || {})
      });
    } catch (error) {
      if (error.message === 'AI_CONFIG_REQUIRED') {
        // Devolver widget de configuración de IA
        return Response.json({
          text: '⚙️ **Configuración de IA requerida**\n\nPara continuar, necesitas configurar tu proveedor de IA y API key.',
          widgets: ['ai_provider_config'],
        });
      }
      throw error; // Re-lanzar otros errores
    }

    // Modo dedicado para generar un caption de forma directa (sin tools)
    if (mode === 'caption') {
      try {
        const captionSystem = `Eres un redactor experto de captions en español para redes sociales.
Escribe una descripción breve y profesional (2-4 líneas), tono natural y claro.
Incluye 2-5 hashtags relevantes (al final), 0-2 emojis discretos si corresponde.
Agrega un CTA sutil solo si aplica.
Reglas de salida: Devuelve únicamente el texto final del caption, sin comillas, sin encabezados ni explicaciones.`;
        const userText =
          typeof prompt === 'string' && prompt
            ? prompt
            : Array.isArray(messages) && messages.length > 0
              ? typeof messages[messages.length - 1]?.content === 'string'
                ? messages[messages.length - 1].content
                : ''
              : '';

        const { text } = await generateText({
          model: userModel,
          messages: convertToModelMessages([
            { role: 'system', parts: [{ type: 'text', text: captionSystem }] },
            { role: 'user', parts: [{ type: 'text', text: userText }] },
          ]),
          maxTokens: 400,
          temperature: 0.7,
        });

        return Response.json({ text, widgets: [] });
      } catch (error) {
        console.error('Error en API chat (caption mode):', error);

        return new Response(
          JSON.stringify({ error: 'Error generando la descripción' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const roroSystemText = `Eres Roro, un asistente experto en redes sociales para crear, planear y publicar contenido.
Sugerir optimizaciones específicas por plataforma (longitud del copy, tono, hashtags, CTA, horarios, formatos, relación imagen/video/copy).
Mantenerte estrictamente dentro del tema de redes sociales y automatización de publicaciones.
Sé conciso, profesional y útil.

IMPORTANTE: Si tu respuesta es de tipo texto, devuélvela bonita y clara usando Markdown (usa títulos, listas, negritas, tablas, bloques de código, etc. si aplica).`;

    const extractText = m => {
      if (typeof m?.content === 'string' && m.content) return m.content;
      if (Array.isArray(m?.parts)) {
        const t = m.parts.find(p => p?.type === 'text');

        return t?.text || '';
      }

      return '';
    };

    const lastText = extractText(
      messages?.[messages?.length - 1] || { content: '' }
    ).toLowerCase();

    const onTopicKeywords = [
      'instagram',
      'facebook',
      'post',
      'publicación',
      'publicaciones',
      'programar',
      'programación',
      'reel',
      'reels',
      'story',
      'stories',
      'feed',
      'social',
      'redes',
      'caption',
      'hashtag',
      'hashtags',
      'calendario',
      'contenido',
      'copy',
      'carrusel',
      'carrousel',
      'meta',
      'creator studio',
      'business suite',
      'hora',
      'horario',
      'día',
      'semana',
      'mes',
    ];
    const offTopicPatterns = [
      'qué es',
      'que es',
      'quién es',
      'quien es',
      'define',
      'definición',
      'explica',
      'historia',
      'biografía',
      'biografia',
      'clima',
      'tiempo',
      'capital de',
      'matem',
      'programación',
      'código',
      'deporte',
      'fútbol',
      'futbol',
      'música',
      'musica',
      'película',
      'pelicula',
      'carro',
      'coche',
      'auto',
      'gato',
      'perro',
    ];

    const hasOnTopic = onTopicKeywords.some(k => lastText.includes(k));
    const hasOffTopic = offTopicPatterns.some(k => lastText.includes(k));

    // Componer mensajes: siempre incluir la instrucción de sistema de Roro
    const composedUIMessages = [
      { role: 'system', parts: [{ type: 'text', text: roroSystemText }] },
      ...(!hasOnTopic && hasOffTopic
        ? [
            {
              role: 'system',
              parts: [
                {
                  type: 'text',
                  text: 'El mensaje del usuario parece fuera del ámbito de redes sociales. Responde exactamente: "No puedo ayudarte con eso" y no agregues nada más.',
                },
              ],
            },
          ]
        : []),
      ...(Array.isArray(messages) ? messages : []),
    ];

    // Normalizar a formato con parts para evitar errores
    const normalizeToParts = m => {
      if (Array.isArray(m?.parts)) return m;
      const text =
        typeof m?.content === 'string' && m.content
          ? m.content
          : extractText(m);

      return { ...m, parts: [{ type: 'text', text }] };
    };
    const normalized = composedUIMessages.map(normalizeToParts);

    // Herramientas (tools) que la IA puede elegir para mostrar widgets
    let wantPlatforms = false;
    let wantInstagramAuth = false;
    let wantFacebookAuth = false;
    let wantYouTubeAuth = false;
    let wantTikTokAuth = false;
    let wantLogout = false;
    let wantClearChat = false;
    let wantPostPublish = false;
    let wantCaptionSuggest = false;
    let wantCalendar = false;

    const showSupportedNetworks = tool({
      description:
        'Muestra un widget visual con las redes soportadas (Instagram, Facebook y TikTok). Úsala cuando el usuario pregunte qué redes/plataformas soportas o manejas. Tambien si el usuario pide ver sus cuentas de redes sociales.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantPlatforms = true;

        return {
          shown: true,
          networks: ['instagram', 'facebook', 'tiktok'],
        };
      },
    });

    const showPostPublishSelection = tool({
      description:
        'Muestra el widget para seleccionar en qué plataformas (Instagram, Facebook, TikTok) publicar/subir un post. Úsala cuando el usuario quiera publicar, subir, postear o programar contenido en redes sociales.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantPostPublish = true;

        return { shown: true, widget: 'post-publish' };
      },
    });

    const requestInstagramAuth = tool({
      description:
        'Muestra el widget de autenticación OAuth de Instagram cuando el usuario quiera conectar/configurar Instagram o actualizar su cuenta.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantInstagramAuth = true;

        return { shown: true, widget: 'instagram-auth' };
      },
    });

    const requestFacebookAuth = tool({
      description:
        'Muestra el widget de autenticación de Facebook cuando el usuario quiera conectar/configurar Facebook o actualizar cuenta.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantFacebookAuth = true;

        return { shown: true, widget: 'facebook-auth' };
      },
    });

    const requestYouTubeAuth = tool({
      description:
        'Muestra el widget de autenticación de YouTube cuando el usuario quiera conectar/configurar YouTube o actualizar cuenta.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantYouTubeAuth = true;

        return { shown: true, widget: 'youtube-auth' };
      },
    });

    const requestTikTokAuth = tool({
      description:
        'Muestra el widget de autenticación de TikTok cuando el usuario quiera conectar/configurar TikTok o actualizar cuenta.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantTikTokAuth = true;

        return { shown: true, widget: 'tiktok-auth' };
      },
    });

    const showLogoutControl = tool({
      description:
        'Muestra el control para cerrar sesión cuando el usuario pida cerrar sesión o salir.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantLogout = true;

        return { shown: true, widget: 'logout' };
      },
    });

    const showCalendar = tool({
      description:
        'Muestra el calendario modal cuando el usuario quiera ver el calendario, programar una fecha, o mencione calendario.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantCalendar = true;

        return { shown: true, widget: 'calendar' };
      },
    });

    const showClearChatControl = tool({
      description:
        'Muestra el control para vaciar/borrar la conversación cuando el usuario lo solicite.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantClearChat = true;

        return { shown: true, widget: 'clear-chat' };
      },
    });

    const suggestCaption = tool({
      description:
        'Genera una descripción profesional breve para la publicación del usuario, con tono natural y hashtags relevantes. Úsala cuando el usuario ya proporcionó una descripción o pida ayuda con el copy.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Descripción base o ideas provistas por el usuario',
          },
          platforms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Plataformas destino (para ajustar hashtags y tono)',
          },
        },
        additionalProperties: false,
      },
      execute: async ({ prompt = '', platforms = [] } = {}) => {
        wantCaptionSuggest = true;

        return { shown: true, widget: 'caption-suggest', prompt, platforms };
      },
    });

    console.log('=== DEBUG userModel ===');
    console.log('userModel value:', userModel);
    console.log('userModel type:', typeof userModel);
    console.log('userModel constructor:', userModel?.constructor?.name);
    console.log('userModel keys:', Object.keys(userModel || {}));
    console.log('========================');
    console.log(userModel)
    try {
      const result = await generateText({
        model: userModel,
        messages: convertToModelMessages(normalized),
        tools: {
          showSupportedNetworks,
          showPostPublishSelection,
          requestInstagramAuth,
          requestFacebookAuth,
          requestYouTubeAuth,
          requestTikTokAuth,
          showLogoutControl,
          showClearChatControl,
          suggestCaption,
          showCalendar,
        },
        maxTokens: 1000,
        temperature: 0.7,
        maxSteps: 3,
      });

      console.log('=== generateText SUCCESS ===');
      console.log('result:', result);
      console.log('============================');

      const { text } = result;

      // Construir la lista de widgets a renderizar a partir de las herramientas elegidas
      const widgets = [];

      if (wantPlatforms) widgets.push('platforms');
      if (wantPostPublish) widgets.push('post-publish');
      if (wantInstagramAuth) widgets.push('instagram-auth');
      if (wantFacebookAuth) widgets.push('facebook-auth');
      if (wantYouTubeAuth) widgets.push('youtube-auth');
      if (wantTikTokAuth) widgets.push('tiktok-auth');
      if (wantLogout) widgets.push('logout');
      if (wantClearChat) widgets.push('clear-chat');
      if (wantCaptionSuggest) widgets.push('caption-suggest');
      if (wantCalendar) widgets.push('calendar');

      return Response.json({ text, widgets });
    } catch (generateError) {
      console.error('=== generateText ERROR ===');
      console.error('Error details:', generateError);
      console.error('Error message:', generateError.message);
      console.error('Error stack:', generateError.stack);
      console.error('==========================');
      throw generateError; // Re-lanzar para el catch principal
    }
  } catch (error) {
    console.error('Error en API chat:', error);

    // Manejar errores específicos de IA
    if (
      error.message === 'AI_CONFIG_REQUIRED' ||
      error.message === 'AI_CONFIG_ERROR'
    ) {
      return Response.json({
        text: '⚠️ **Error de configuración de IA**\n\nHubo un problema con tu configuración de IA. Por favor, actualiza tu proveedor y API key.',
        widgets: ['ai_provider_config'],
      });
    }

    // Manejar errores de API key inválida
    if (
      error.message &&
      (error.message.includes('API key') ||
        error.message.includes('Invalid authentication') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('403') ||
        error.message.includes('401'))
    ) {
      return Response.json({
        text: '🔑 **API Key inválida**\n\nTu API key no es válida o ha expirado. Por favor, actualiza tu configuración.',
        widgets: ['ai_provider_config'],
      });
    }

    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
