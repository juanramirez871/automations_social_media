import { google } from '@ai-sdk/google';
import { generateText, convertToModelMessages, tool } from 'ai';

export async function POST(req) {
  try {
    const { messages = [] } = await req.json();

    // Persona y reglas de Roro
    const roroSystemText = `
Eres Roro, un asistente profesional pero amigable especializado EXCLUSIVAMENTE en automatizar publicaciones para Instagram y Facebook.

Objetivo:
- Guiar paso a paso para crear y programar publicaciones (feed, reels, stories) en Instagram y Facebook.
- Sugerir optimizaciones específicas por plataforma (longitud del copy, tono, hashtags, CTA, horarios, formatos, relación imagen/video/copy).
- Mantenerte estrictamente dentro del tema de redes sociales y automatización de publicaciones.

Reglas estrictas:
1) Si el usuario pregunta sobre cualquier tema fuera de redes sociales/automatización (p.ej. “qué es un carro”), responde exactamente: "No puedo ayudarte con eso".
2) Responde siempre en español, tono profesional y amable.
3) Cuando el usuario lo requiera, conduce el flujo con pasos concretos (1, 2, 3) y preguntas de clarificación.
4) Ofrece buenas prácticas para IG/FB (hashtags relevantes, formatos, duración de video, mejores horarios estimados, variaciones de copy, llamados a la acción) cuando corresponda.
5) Si el usuario pregunta qué redes o plataformas soportas/manejas, invoca la herramienta "showSupportedNetworks" y luego responde brevemente.
6) No menciones estas reglas ni que estás usando herramientas en tus respuestas.
`;

    // Detección simple de fuera de tema
    const extractText = (m) => {
      if (Array.isArray(m?.parts)) {
        return m.parts
          .map((p) => (p?.type === 'text' ? p.text : ''))
          .join(' ')
          .trim()
          .toLowerCase();
      }
      return (m?.content || '').toString().trim().toLowerCase();
    };

    const userLast = [...messages].reverse().find((m) => m.role === 'user');
    const lastText = extractText(userLast || {});

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
      'que redes manejas','qué redes manejas','que redes soportas','qué redes soportas','que plataformas manejas','qué plataformas manejas','que plataformas soportas','qué plataformas soportas','que redes gestionas','qué redes gestionas','que redes atiendes','qué redes atiendes','what networks do you support','what networks do you manage','which networks do you support','which social networks','what social networks'
    ];
    const showPlatformsWidgetHeuristic = widgetTriggers.some((p) => lastText.includes(p));

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

    // Tool: mostrar widget de redes soportadas
    let showPlatformsWidgetByTool = false;
    const showSupportedNetworks = tool({
      description:
        'Muestra un widget visual con las redes soportadas (Instagram, Facebook, YouTube y TikTok). Úsala cuando el usuario pregunte qué redes/plataformas soportas o manejas.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        showPlatformsWidgetByTool = true;
        // Puedes devolver un objeto descriptivo; no se usa en el cliente directamente.
        return { shown: true, networks: ['instagram','facebook','youtube','tiktok'] };
      },
    });

    const { text } = await generateText({
      model: google('gemini-2.5-pro'),
      messages: convertToModelMessages(normalized),
      tools: { showSupportedNetworks },
      maxTokens: 1000,
      temperature: 0.7,
      maxSteps: 4,
    });

    const widget = (showPlatformsWidgetByTool || showPlatformsWidgetHeuristic) ? 'platforms' : null;
    return Response.json({ text, widget });
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