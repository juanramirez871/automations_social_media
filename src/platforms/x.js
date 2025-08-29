const axios = require('axios');
const config = require('../config');

// Nota: La API de X (Twitter) para publicar medios requiere OAuth 1.0a y endpoints específicos.
// Aquí dejamos un stub que espera URLs de medios ya hosteadas (no upload) y usa tweet simple vía v2 Tweet create (requiere Elevated access).
async function postToX({ text }) {
  // Placeholder: normalmente usarías OAuth 1.0a y el endpoint POST /2/tweets
  // Aquí simulamos llamada. Implementación real requiere librería oauth-1.0a o el SDK oficial.
  try {
    // TODO: Implementación real usando tokens de X
    // Lanzamos error si no hay credenciales mínimas
    if (!config.x.bearerToken) {
      throw new Error('Configurar credenciales de X en .env');
    }
    // Simulación de éxito
    return { platform: 'x', id: 'simulated_tweet_id', url: 'https://x.com/your_user/status/simulated_tweet_id' };
  } catch (err) {
    const error = err?.response?.data || err.message;
    console.error('X post error:', error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

module.exports = { postToX };