import config from '../config.js';
import { Client } from 'twitter-api-sdk';
import { logger } from '../logger.js';

let twClient = null;
function getTwitterClient() {
  if (!twClient) {
    const token = config.x.bearerToken;
    if (!token) {
      throw new Error('Configurar X_BEARER_TOKEN con permisos tweet.write');
    }
    twClient = new Client(token);
  }
  return twClient;
}

// Publicar un tweet de texto usando Twitter API v2
async function postToX({ text }) {
  try {
    const client = getTwitterClient();
    const res = await client.tweets.createTweet({ text });
    const id = res?.data?.id;
    return { platform: 'x', id, url: id ? `https://x.com/i/web/status/${id}` : undefined };
  } catch (err) {
    const error = err?.errors || err?.response?.data || err?.message || err;
    logger.error({ err: error }, 'X post error');
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

export { postToX };