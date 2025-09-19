/**
 * Sistema para verificar el estado de publicaciones en TikTok
 */

/**
 * Verifica el estado de una publicación en TikTok
 * @param {string} publishId - ID de la publicación retornado por TikTok
 * @param {string} accessToken - Token de acceso de TikTok
 * @returns {Promise<object>} Estado de la publicación
 */
export async function checkTikTokPublishStatus(publishId, accessToken) {
  try {
    const response = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error verificando estado de TikTok:', data);
      throw new Error(data.error?.message || 'Error verificando estado de publicación');
    }

    return {
      status: data.data?.status || 'UNKNOWN',
      failReason: data.data?.fail_reason || null,
      publicPostIds: data.data?.publicaly_available_post_id || [],
      uploadedBytes: data.data?.uploaded_bytes || 0,
      downloadedBytes: data.data?.downloaded_bytes || 0,
    };
  } catch (error) {
    console.error('Error en checkTikTokPublishStatus:', error);
    throw error;
  }
}

/**
 * Realiza polling del estado de una publicación hasta que se complete o falle
 * @param {string} publishId - ID de la publicación
 * @param {string} accessToken - Token de acceso
 * @param {object} options - Opciones de polling
 * @returns {Promise<object>} Estado final de la publicación
 */
export async function pollTikTokPublishStatus(publishId, accessToken, options = {}) {
  const {
    maxAttempts = 20,           // Máximo 20 intentos
    intervalMs = 15000,         // 15 segundos entre intentos
    timeoutMs = 300000,         // 5 minutos timeout total
  } = options;

  console.log('Iniciando polling del estado de TikTok:', {
    publishId,
    maxAttempts,
    intervalMs,
    timeoutMs
  });

  const startTime = Date.now();
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Verificar timeout total
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout: El video no se procesó en ${timeoutMs / 1000} segundos`);
    }

    attempts++;
    
    try {
      const status = await checkTikTokPublishStatus(publishId, accessToken);
      
      console.log(`Intento ${attempts}/${maxAttempts} - Estado TikTok:`, {
        publishId,
        status: status.status,
        failReason: status.failReason,
        publicPostIds: status.publicPostIds,
        uploadedBytes: status.uploadedBytes,
        downloadedBytes: status.downloadedBytes
      });

      // Estados finales
      if (status.status === 'PUBLISH_COMPLETE') {
        console.log('✅ Video publicado exitosamente en TikTok:', {
          publishId,
          publicPostIds: status.publicPostIds,
          attempts,
          timeElapsed: `${(Date.now() - startTime) / 1000}s`
        });
        return {
          success: true,
          status: status.status,
          publicPostIds: status.publicPostIds,
          attempts,
          timeElapsed: Date.now() - startTime
        };
      }

      if (status.status === 'FAILED') {
        console.error('❌ Video falló en TikTok:', {
          publishId,
          failReason: status.failReason,
          attempts,
          timeElapsed: `${(Date.now() - startTime) / 1000}s`
        });
        return {
          success: false,
          status: status.status,
          failReason: status.failReason,
          attempts,
          timeElapsed: Date.now() - startTime
        };
      }

      // Estados en progreso - continuar polling
      if (['PROCESSING_DOWNLOAD', 'PROCESSING_UPLOAD', 'SEND_TO_USER_INBOX'].includes(status.status)) {
        console.log(`⏳ TikTok procesando (${status.status})... esperando ${intervalMs/1000}s`);
        
        // Esperar antes del siguiente intento
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        continue;
      }

      // Estado desconocido
      console.warn('⚠️ Estado desconocido de TikTok:', status.status);
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

    } catch (error) {
      console.error(`Error en intento ${attempts}:`, error.message);
      
      // Si es el último intento, lanzar el error
      if (attempts >= maxAttempts) {
        throw error;
      }
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // Si llegamos aquí, se agotaron los intentos
  throw new Error(`Se agotaron los ${maxAttempts} intentos sin obtener un estado final`);
}

/**
 * Obtiene información detallada sobre los estados de TikTok
 * @param {string} status - Estado actual
 * @returns {object} Información del estado
 */
export function getTikTokStatusInfo(status) {
  const statusInfo = {
    'PROCESSING_UPLOAD': {
      description: 'Subida en proceso (solo para FILE_UPLOAD)',
      isProcessing: true,
      isFinal: false
    },
    'PROCESSING_DOWNLOAD': {
      description: 'Descarga desde URL en proceso (solo para PULL_FROM_URL)',
      isProcessing: true,
      isFinal: false
    },
    'SEND_TO_USER_INBOX': {
      description: 'Notificación enviada al inbox del usuario para completar el borrador',
      isProcessing: true,
      isFinal: false
    },
    'PUBLISH_COMPLETE': {
      description: 'Contenido publicado exitosamente',
      isProcessing: false,
      isFinal: true,
      isSuccess: true
    },
    'FAILED': {
      description: 'Error en el proceso de publicación',
      isProcessing: false,
      isFinal: true,
      isSuccess: false
    }
  };

  return statusInfo[status] || {
    description: `Estado desconocido: ${status}`,
    isProcessing: false,
    isFinal: false,
    isSuccess: false
  };
}