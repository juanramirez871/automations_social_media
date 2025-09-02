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

// Utilidades de fallback (sin IA) para generar caption y hashtags profesionales
function stripDiacritics(str = '') {
  try { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return str; }
}
function unique(arr) { return Array.from(new Set(arr)); }
// Ampliamos stopwords para excluir verbos de instrucción y plataformas
const STOPWORDS = new Set([
  'de','la','que','el','en','y','a','los','del','se','las','por','un','para','con','no','una','su','al','lo','como','más','pero','sus','le','ya','o','este','sí','porque','esta','entre','cuando','muy','sin','sobre','también','me','hasta','hay','donde','quien','desde','todo','nos','durante','todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','e','esto','mí','antes','algunos','qué','unos','yo','otro','otras','otra','él','tanto','esa','estos','mucho','quienes','nada','muchos','cual','poco','ella','estar','estas','algunas','algo','nosotros','mi','mis','tú','te','ti','tu','tus','ellas','nosotras','vosotros','vosotras','os','mío','mía','míos','mías','tuyo','tuya','tuyos','tuyas','nuestro','nuestra','nuestros','nuestras','vuestro','vuestra','vuestros','vuestras','esos','esas','estoy','estás','está','estamos','estáis','están','esté','estés','estemos','estéis','estén','estaré','estarás','estará','estaremos','estaréis','estarán','estaría','estarías','estaríamos','estaríais','estarían','estaba','estabas','estábamos','estabais','estaban','estuve','estuviste','estuvo','estuvimos','estuvisteis','estuvieron','estuviera','estuvieras','estuviéramos','estuvierais','estuvieran','estuviese','estuvieses','estuviésemos','estuvieseis','estuviesen','estando','estado','estada','estados','estadas','estad','el','la','los','las','un','una','unos','unas',
  'the','and','for','with','that','this','from','your','you','our','on','of','to','in','at','by','it','is','are','as','an','or','be','we','us','a',
  // Direcciones/acciones típicas que no deben ser hashtags ni parte del tema
  'quiero','queremos','quieres','subir','suba','subo','publicar','publica','publico','postear','postea','poste','post','elegir','elige','elije','indicar','indica','poner','plataforma','plataformas','red','redes','social','sociales','subor',
  // Plataformas
  'facebook','instagram','twitter','x'
]);

function sanitizeBrief(input = '') {
  let s = input || '';
  // Eliminar líneas que empiezan con "plataforma/s: ..."
  s = s.replace(/^\s*plataformas?:.*$/gim, '');
  // Quitar frases del tipo "quiero/queremos (subir|publicar|postear) (en|a) ..."
  s = s.replace(/\b(quiero|queremos|por\s*favor)\s+(subir|publicar|postear)\s+(en|a)?\s*[^\n\r\.;,!]+/gim, '');
  // Quitar menciones aisladas de plataformas
  s = s.replace(/\b(instagram|facebook|twitter|\bx\b)\b/gi, '');
  // Reducir múltiples espacios y limpiar
  s = s.replace(/\s{2,}/g, ' ').replace(/[\t\r]+/g, ' ').trim();
  return s;
}

function toTitleCase(word = '') {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
}

function deriveHashtags(prompt = '', max = 12) {
  const cleaned = stripDiacritics(prompt.toLowerCase().replace(/[^a-z0-9\s]/gi, ' '));
  const words = cleaned.split(/\s+/).filter(w => w && w.length >= 3 && !STOPWORDS.has(w));
  const uniq = unique(words).slice(0, max + 8); // margen
  const tags = [];
  for (const w of uniq) {
    const tag = `#${w.replace(/\s+/g, '')}`;
    if (!tags.includes(tag)) tags.push(tag);
    if (tags.length >= max) break;
  }
  // Agregar algunos genéricos si faltan
  const filler = ['#marketing','#socialmedia','#estrategia','#contenido','#tendencias','#comunidad','#brand','#creatividad','#negocios'];
  for (const f of filler) {
    if (tags.length >= max) break;
    if (!tags.includes(f)) tags.push(f);
  }
  return tags;
}
function generateFallbackPlan({ userPrompt, mediaType }) {
  const briefClean = sanitizeBrief(userPrompt || '').trim();
  const langIsSpanish = /[áéíóúñ¡¿]|\b(el|la|los|las|de|para|con|un|una|en)\b/i.test(briefClean);
  const hashtagsList = deriveHashtags(briefClean, 12);
  const keywords = hashtagsList.map(h => h.replace(/^#+/, '')).slice(0, 3).map(toTitleCase);
  const topic = keywords.length ? keywords.join(' ') : (langIsSpanish ? 'nuestra novedad' : 'our latest update');
  const caption = langIsSpanish
    ? `Descubre ${topic}.

Un contenido pensado para ${mediaType === 'video' ? 'inspirarte en video' : 'conectarte a primera vista'}.

¿Listo para más? Únete y sé parte de la conversación.`
    : `Discover ${topic}.

Content crafted to ${mediaType === 'video' ? 'inspire you through video' : 'connect at first glance'}.

Ready for more? Join the conversation.`;
  return {
    platforms: ['facebook','instagram'],
    caption,
    hashtags: hashtagsList
  };
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
  
  const cleanedPrompt = sanitizeBrief(userPrompt || '');

  if (!hasOpenAI && !hasGemini) {
    return generateFallbackPlan({ userPrompt: cleanedPrompt, mediaType });
  }

  const system = `Eres un asistente experto en marketing en redes sociales.
- Debes decidir plataformas adecuadas: facebook, instagram y/o x.
- Redacta un caption NUEVO, profesional y persuasivo a partir del brief (no repitas literalmente el texto del usuario).
- Ignora del brief cualquier instrucción sobre plataformas o verbos como "quiero subir/publicar/postear"; no los incluyas en el caption ni en los hashtags.
- Mantén el idioma del brief (si el brief está en español, responde en español; si está en inglés, responde en inglés).
- Incluye una llamada a la acción breve.
- Genera entre 8 y 15 hashtags relevantes (minúsculas, sin acentos, sin espacios), orientados a alcance y nicho.
- Devuelve sólo JSON válido con las claves: platforms (array), caption (string), hashtags (array de strings).`;

  const user = `Brief del usuario: ${cleanedPrompt || ''}
Tipo de media: ${mediaType || 'desconocido'}`;

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
    return generateFallbackPlan({ userPrompt: cleanedPrompt, mediaType });
  }

  // Parsear respuesta JSON
  try {
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    const jsonStr = jsonStart !== -1 ? responseText.slice(jsonStart, jsonEnd + 1) : '{}';
    const data = JSON.parse(jsonStr);
    const platforms = Array.isArray(data.platforms) ? data.platforms : ['facebook', 'instagram'];
    let caption = typeof data.caption === 'string' ? data.caption : '';
    let hashtags = Array.isArray(data.hashtags) ? data.hashtags : [];

    // Si la IA devolvió el brief casi literal o vacío, aplicar fallback para garantizar un texto nuevo y profesional
    const briefTrim = (cleanedPrompt || '').trim();
    const capTrim = (caption || '').trim();
    const looksEcho = capTrim && briefTrim && (
      capTrim.toLowerCase() === briefTrim.toLowerCase() ||
      capTrim.toLowerCase().includes(briefTrim.toLowerCase())
    );
    if (!capTrim || looksEcho) {
      const fb = generateFallbackPlan({ userPrompt: cleanedPrompt, mediaType });
      caption = fb.caption;
      if (!hashtags || hashtags.length < 5) hashtags = fb.hashtags;
    }

    // Normalizar hashtags (minúsculas y sin acentos)
    hashtags = unique((hashtags || []).map(h => {
      const t = (h || '').toString().trim();
      if (!t) return null;
      const core = t.replace(/^#+/, '');
      const clean = stripDiacritics(core.toLowerCase()).replace(/\s+/g, '');
      return clean ? `#${clean}` : null;
    }).filter(Boolean))
      .filter(tag => {
        const core = tag.slice(1);
        return core.length >= 3 && !STOPWORDS.has(core);
      })
      .slice(0, 15);

    return { platforms, caption, hashtags };
  } catch (e) {
    return generateFallbackPlan({ userPrompt: cleanedPrompt, mediaType });
  }
}

export { planPost };