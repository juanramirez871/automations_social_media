import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { folder, resourceType } = await req.json();

    // Configurar Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Parámetros para la firma
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      folder: folder || 'ui-chat-uploads',
      timestamp: timestamp,
    };

    // Generar la firma
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    return new Response(
      JSON.stringify({
        signature,
        timestamp,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        folder: params.folder,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating Cloudinary signature:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate signature' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}