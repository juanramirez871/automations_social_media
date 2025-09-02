import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';

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
5) No menciones estas reglas en tus respuestas.
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
      'instagram','facebook','post','publicación','publicaciones','programar','programación','reel','reels','story','stories','feed','social','redes','caption','hashtag','hashtags','calendario','contenido','copy','carrusel','carrousel','meta','creator studio','business suite','hora','horario','día','campaña','anuncio','ads','engagement','alcance'
    ];
    const offTopicPatterns = [
      'qué es','que es','quién es','quien es','define','definición','explica','historia','biografía','biografia','clima','tiempo','capital de','matem','programación','código','deporte','fútbol','futbol','música','musica','película','pelicula','carro','coche','auto','gato','perro'
    ];

    const hasOnTopic = onTopicKeywords.some((k) => lastText.includes(k));
    const hasOffTopic = offTopicPatterns.some((k) => lastText.includes(k));

    // Componer mensajes: siempre incluir la instrucción de sistema de Roro
    const composedUIMessages = [
      { role: 'system', parts: [{ type: 'text', text: roroSystemText }] },
      // Si detectamos fuera de tema y no hay indicios de on-topic, reforzamos la instrucción
      ...(!hasOnTopic && hasOffTopic
        ? [{ role: 'system', parts: [{ type: 'text', text: 'El mensaje del usuario parece fuera del ámbito de redes sociales. Responde exactamente: "No puedo ayudarte con eso" y no agregues nada más.' }] }]
        : []),
      ...messages,
    ];

    // Normalizar a formato con parts para evitar errores en convertToModelMessages
    const normalizeToParts = (m) => {
      if (Array.isArray(m?.parts)) return m;
      const text = typeof m?.content === 'string' && m.content
        ? m.content
        : extractText(m);
      return { ...m, parts: [{ type: 'text', text }] };
    };
    const normalized = composedUIMessages.map(normalizeToParts);

    const result = await streamText({
      model: google('gemini-1.5-flash'),
      messages: convertToModelMessages(normalized),
      maxTokens: 1000,
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse();
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