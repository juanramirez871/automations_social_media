export { publishToInstagram } from './instagram.js';
export { publishToFacebook } from './facebook.js';
export { publishToYouTube } from './youtube.js';
export { publishToTikTok } from './tiktok.js';
export const PUBLISHERS = {
  instagram: async params => {
    const { publishToInstagram } = await import('./instagram.js');

    return publishToInstagram(params);
  },
  facebook: async params => {
    const { publishToFacebook } = await import('./facebook.js');

    return publishToFacebook(params);
  },
  youtube: async params => {
    const { publishToYouTube } = await import('./youtube.js');

    return publishToYouTube(params);
  },
  tiktok: async params => {
    const { publishToTikTok } = await import('./tiktok.js');

    return publishToTikTok(params);
  },
};

export async function publishToMultiplePlatforms({
  caption,
  imageUrl,
  videoUrl,
  platforms = [],
  userId,
  privacyLevel,
  supabase,
}) {
  const results = [];

  const publishPromises = platforms.map(async platform => {
    if (!PUBLISHERS[platform]) {
      return {
        platform,
        success: false,
        error: `Plataforma '${platform}' no soportada`,
      };
    }

    try {
      return await PUBLISHERS[platform]({
        caption,
        imageUrl,
        videoUrl,
        userId,
        privacyLevel,
        supabase,
      });
    } catch (error) {
      return {
        platform,
        success: false,
        error: error.message,
      };
    }
  });

  const publishResults = await Promise.allSettled(publishPromises);

  publishResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      results.push({
        platform: platforms[index],
        success: false,
        error: result.reason?.message || 'Error desconocido',
      });
    }
  });

  return results;
}
