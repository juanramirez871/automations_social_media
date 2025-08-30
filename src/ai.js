import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './config.js';

let openaiClient = null;
let geminiClient = null;

function getOpenAIClient() {
  if (!openaiClient && config.ai.openai.apiKey) {
    openaiClient = new OpenAI({ apiKey: config.ai.openai.apiKey });
  }
  return openaiClient;
}

function getGeminiClient() {
  if (!geminiClient && config.ai.gemini.apiKey) {
    geminiClient = new GoogleGenerativeAI(config.ai.gemini.apiKey);
  }
  return geminiClient;
}

/*
  Dado el prompt del usuario (texto), y metadatos del medio (opcional),
  devolver un JSON con:
  {
    platforms: ["facebook", "instagram", "x"],
    caption: "...",
    hashtags: ["#...", "#..."],
  }
*/
async function planPost({ userPrompt, mediaType }) {
  const provider = config.ai.provider;
  
  // Fallback si no hay configuración de IA
  const hasOpenAI = config.ai.openai.apiKey;
  const hasGemini = config.ai.gemini.apiKey;
  
  if (!hasOpenAI && !hasGemini) {
    const fallbackCaption = userPrompt || '';
    return {
      platforms: ['facebook', 'instagram'],
      caption: fallbackCaption,
      hashtags: []
    };
  }

  const system = `Eres un asistente experto en marketing en redes sociales.\n\
- Debes decidir plataformas adecuadas: facebook, instagram y/o x.\n\
- Genera caption atractivo y profesional.\n\
- Genera 5-10 hashtags relevantes.\n\
- Devuelve sólo JSON válido con las claves: platforms (array), caption (string), hashtags (array de strings).`;

  const user = `Brief del usuario: ${userPrompt || ''}\nTipo de media: ${mediaType || 'desconocido'}`;

  let responseText = '';

  try {
    if (provider === 'gemini' && hasGemini) {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: 'gemini-pro' });
      const prompt = `${system}\n\n${user}`;
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } else if (provider === 'openai' && hasOpenAI) {
      const client = getOpenAIClient();
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      });
      responseText = resp.choices?.[0]?.message?.content || '{}';
    } else {
      // Fallback al proveedor disponible
      if (hasOpenAI) {
        const client = getOpenAIClient();
        const resp = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        });
        responseText = resp.choices?.[0]?.message?.content || '{}';
      } else if (hasGemini) {
        const client = getGeminiClient();
        const model = client.getGenerativeModel({ model: 'gemini-pro' });
        const prompt = `${system}\n\n${user}`;
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      }
    }
  } catch (error) {
    console.error(`Error with ${provider} provider:`, error.message);
    // Fallback en caso de error
    return {
      platforms: ['facebook', 'instagram'],
      caption: userPrompt || '',
      hashtags: []
    };
  }

  // Parsear respuesta JSON
  try {
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    const jsonStr = jsonStart !== -1 ? responseText.slice(jsonStart, jsonEnd + 1) : '{}';
    const data = JSON.parse(jsonStr);
    const platforms = Array.isArray(data.platforms) ? data.platforms : ['facebook', 'instagram'];
    const caption = typeof data.caption === 'string' ? data.caption : userPrompt;
    const hashtags = Array.isArray(data.hashtags) ? data.hashtags : [];
    return { platforms, caption, hashtags };
  } catch (e) {
    return { platforms: ['facebook', 'instagram'], caption: userPrompt, hashtags: [] };
  }
}

export { planPost };