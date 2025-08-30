import 'dotenv/config';

const config = {
  port: process.env.PORT || 3030,
  whatsapp: {
    // Solo Baileys (no oficial)
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'openai', // 'openai' | 'gemini'
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
  },
  // Deprecated: mantener por compatibilidad
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
    // Opcional: para auto refrescar el token cuando expira
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    userAccessToken: process.env.FACEBOOK_USER_ACCESS_TOKEN, // idealmente long-lived
  },
  instagram: {
    username: process.env.INSTAGRAM_USERNAME,
    password: process.env.INSTAGRAM_PASSWORD,
    cookieFile: process.env.INSTAGRAM_COOKIE_FILE || './instagram_cookies.json',
  },
  x: {
    bearerToken: process.env.X_BEARER_TOKEN,
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    keepUploads: String(process.env.CLOUDINARY_KEEP_UPLOADS || '').toLowerCase() === 'true',
  }
};

export default config;