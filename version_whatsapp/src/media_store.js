import { v2 as cloudinary } from 'cloudinary';
import http from './http.js';
import config from './config.js';

// Config Cloudinary
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

// Descarga binaria desde una URL pública (sin cabeceras)
async function downloadBinary(url) {
  const res = await http.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data, 'binary');
}

// Sube a Cloudinary desde URL directa (Cloudinary hace fetch)
async function uploadFromUrl({ url, resourceType = 'image', folder = 'social_automation' }) {
  const isVideo = resourceType === 'video';
  const options = { folder, resource_type: isVideo ? 'video' : 'image', overwrite: true, invalidate: true };
  const result = await cloudinary.uploader.upload(url, options);
  return { publicId: result.public_id, secureUrl: result.secure_url, resourceType: isVideo ? 'video' : 'image' };
}

// Sube a Cloudinary un buffer binario (útil cuando el origen requiere cabeceras, ej. WhatsApp Graph)
function uploadBuffer({ buffer, resourceType = 'image', folder = 'social_automation' }) {
  return new Promise((resolve, reject) => {
    const options = { folder, resource_type: resourceType, overwrite: true, invalidate: true };
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve({ publicId: result.public_id, secureUrl: result.secure_url, resourceType });
    });
    uploadStream.end(buffer);
  });
}

// Eliminar de Cloudinary por public_id
async function deleteMedia(publicId, resourceType = 'image') {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.error('Cloudinary delete error:', e.message);
  }
}

export { uploadFromUrl, uploadBuffer, deleteMedia, downloadBinary };