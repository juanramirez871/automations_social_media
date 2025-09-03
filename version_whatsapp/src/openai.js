import OpenAI from 'openai';
import config from './config.js';

let client = null;
function getClient() {
  if (!client && config.openai.apiKey) {
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

async function planPost({ userPrompt, mediaType }) {
  if (!config.openai.apiKey) {
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

  const api = getClient();
  const resp = await api.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  const text = resp.choices?.[0]?.message?.content || '{}';
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const jsonStr = jsonStart !== -1 ? text.slice(jsonStart, jsonEnd + 1) : '{}';
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