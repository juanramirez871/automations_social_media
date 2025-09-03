import { google } from '@ai-sdk/google';
import { generateText, convertToModelMessages, tool } from 'ai';

export async function POST(req) {
  try {
    const { messages } = await req.json();

    const roroSystemText = `Eres Roro, un asistente experto en redes sociales para crear, planear y publicar contenido.
- Sugerir optimizaciones específicas por plataforma (longitud del copy, tono, hashtags, CTA, horarios, formatos, relación imagen/video/copy).
- Mantenerte estrictamente dentro del tema de redes sociales y automatización de publicaciones.
- Sé conciso, profesional y útil.`;

    const extractText = (m) => {
      if (typeof m?.content === 'string' && m.content) return m.content;
      if (Array.isArray(m?.parts)) {
        const t = m.parts.find((p) => p?.type === 'text');
        return t?.text || '';
      }
      return '';
    };

    const lastText = extractText(messages?.[messages?.length - 1] || { content: '' }).toLowerCase();

    const onTopicKeywords = [
      'instagram','facebook','post','publicación','publicaciones','programar','programación','reel','reels','story','stories','feed','social','redes','caption','hashtag','hashtags','calendario','contenido','copy','carrusel','carrousel','meta','creator studio','business suite','hora','horario','día','semana','mes'
    ];
    const offTopicPatterns = [
      'qué es','que es','quién es','quien es','define','definición','explica','historia','biografía','biografia','clima','tiempo','capital de','matem','programación','código','deporte','fútbol','futbol','música','musica','película','pelicula','carro','coche','auto','gato','perro'
    ];

    const hasOnTopic = onTopicKeywords.some((k) => lastText.includes(k));
    const hasOffTopic = offTopicPatterns.some((k) => lastText.includes(k));

    // Widget: "qué redes manejas" / "qué plataformas soportas" (fallback por heurística)
    const widgetTriggers = [
      'que redes manejas','qué redes manejas','que redes soportas','qué redes soportas','que plataformas manejas','qué plataformas manejas','que plataformas soportas','qué plataformas soportas','que redes gestionas','qué redes gestionas','que redes atiendes','qué redes atiendes','what networks do you support','what networks do you manage','which networks do you support','which social networks','what social networks',
      'mis redes','mis redes sociales','mis plataformas','mis cuentas','mis cuentas de redes','mis perfiles','mis perfiles de redes','plataformas que manejo'
    ];
    const showPlatformsWidgetHeuristic = false;

    // Componer mensajes: siempre incluir la instrucción de sistema de Roro
    const composedUIMessages = [
      { role: 'system', parts: [{ type: 'text', text: roroSystemText }] },
      ...(!hasOnTopic && hasOffTopic
        ? [{ role: 'system', parts: [{ type: 'text', text: 'El mensaje del usuario parece fuera del ámbito de redes sociales. Responde exactamente: "No puedo ayudarte con eso" y no agregues nada más.' }] }]
        : []),
      ...messages,
    ];

    // Normalizar a formato con parts para evitar errores
    const normalizeToParts = (m) => {
      if (Array.isArray(m?.parts)) return m;
      const text = typeof m?.content === 'string' && m.content
        ? m.content
        : extractText(m);
      return { ...m, parts: [{ type: 'text', text }] };
    };
    const normalized = composedUIMessages.map(normalizeToParts);

    // Herramientas (tools) que la IA puede elegir para mostrar widgets
    let wantPlatforms = false;
    let wantInstagramCreds = false;
    let wantFacebookAuth = false;
    let wantYouTubeAuth = false;
    let wantLogout = false;
    let wantClearChat = false;

    const showSupportedNetworks = tool({
      description:
        'Muestra un widget visual con las redes soportadas (Instagram, Facebook, YouTube y TikTok). Úsala cuando el usuario pregunte qué redes/plataformas soportas o manejas. Tambien si el usuario pide ver sus cuentas de redes sociales.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        wantPlatforms = true;
        return { shown: true, networks: ['instagram','facebook','youtube','tiktok'] };
      },
    });

    const requestInstagramCredentials = tool({
      description:
        'Muestra un formulario para ingresar credenciales de Instagram cuando el usuario quiera conectar/configurar Instagram o actualizar sus credenciales.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        wantInstagramCreds = true;
        return { shown: true, widget: 'instagram-credentials' };
      },
    });

    const requestFacebookAuth = tool({
      description:
        'Muestra el widget de autenticación de Facebook cuando el usuario quiera conectar/configurar Facebook o actualizar cuenta.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        wantFacebookAuth = true;
        return { shown: true, widget: 'facebook-auth' };
      },
    });

    const requestYouTubeAuth = tool({
      description:
        'Muestra el widget de autenticación de YouTube cuando el usuario quiera conectar/configurar YouTube o actualizar cuenta.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        wantYouTubeAuth = true;
        return { shown: true, widget: 'youtube-auth' };
      },
    });

    const showLogoutControl = tool({
      description: 'Muestra el control para cerrar sesión cuando el usuario pida cerrar sesión o salir.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        wantLogout = true;
        return { shown: true, widget: 'logout' };
      },
    });

    const showClearChatControl = tool({
      description: 'Muestra el control para vaciar/borrar la conversación cuando el usuario lo solicite.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        wantClearChat = true;
        return { shown: true, widget: 'clear-chat' };
      },
    });

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      messages: convertToModelMessages(normalized),
      tools: { showSupportedNetworks, requestInstagramCredentials, requestFacebookAuth, requestYouTubeAuth, showLogoutControl, showClearChatControl },
      maxTokens: 1000,
      temperature: 0.7,
      maxSteps: 6,
    });

    // Construir la lista de widgets a renderizar a partir de las herramientas elegidas
    const widgets = [];
    if (wantPlatforms) widgets.push('platforms');
    if (wantInstagramCreds) widgets.push('instagram-credentials');
    if (wantFacebookAuth) widgets.push('facebook-auth');
    if (wantYouTubeAuth) widgets.push('youtube-auth');
    if (wantLogout) widgets.push('logout');
    if (wantClearChat) widgets.push('clear-chat');

    return Response.json({ text, widgets });
  } catch (error) {
    console.error('Error en API chat:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}