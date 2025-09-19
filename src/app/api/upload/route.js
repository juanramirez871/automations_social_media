import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: 'file is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const folder = formData.get('folder') || 'ui-chat-uploads';
    const resourceType = formData.get('resourceType') || 'auto';

    // Configurar Cloudinary desde variables de entorno
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );

      stream.end(buffer);
    });

    return new Response(
      JSON.stringify({
        secureUrl: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        width: result.width || null,
        height: result.height || null,
        duration: result.duration || null,
        bytes: result.bytes || null,
        format: result.format || null,
        originalFilename: result.original_filename || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e?.message || 'Upload failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
