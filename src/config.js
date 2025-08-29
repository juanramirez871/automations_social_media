import 'dotenv/config';

const config = {
  port: process.env.PORT || 3030,
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || 'cloud',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
  },
  instagram: {
    businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
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
  }
};

export default config;