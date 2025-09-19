import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configuración para aumentar el límite de payload
export const config = {
  api: {
    responseLimit: '20mb',
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

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

    // Validación de tamaño de archivo (límite de 18MB para evitar problemas en Vercel)
    const MAX_FILE_SIZE = 18 * 1024 * 1024; // 18MB
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ 
          error: `El archivo es demasiado grande. Tamaño máximo permitido: 18MB. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
        }), 
        {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const folder = formData.get('folder') || 'ui-chat-uploads';
    const resourceType = formData.get('resourceType') || 'auto';

    // Configurar Cloudinary desde variables de entorno
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    console.log(`Procesando archivo: ${file.name}, tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Configuración optimizada para archivos grandes
    const uploadOptions = {
      resource_type: resourceType,
      folder,
      // Configuraciones para mejorar la subida de archivos grandes
      chunk_size: 10 * 1024 * 1024, // 10MB chunks para archivos grandes
      timeout: 120000, // 2 minutos de timeout
    };

    // Configuración específica para videos grandes
    if (resourceType === 'video' && file.size > 10 * 1024 * 1024) {
      uploadOptions.eager = [
        { width: 1280, height: 720, crop: 'limit', quality: 'auto' }
      ];
      uploadOptions.eager_async = true;
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, uploadResult) => {
          if (error) {
            console.error('Error en Cloudinary:', error);
            return reject(error);
          }
          console.log(`Upload exitoso: ${uploadResult.secure_url}`);
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
