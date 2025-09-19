/**
 * Validador de URLs para TikTok
 * Verifica que las URLs de video sean accesibles desde TikTok
 */

/**
 * Verifica si una URL es accesible y válida para TikTok
 * @param {string} videoUrl - URL del video a verificar
 * @returns {Promise<{isValid: boolean, error?: string, details?: object}>}
 */
export async function validateVideoUrl(videoUrl) {
  try {
    // Verificar que la URL sea válida
    let url;
    try {
      url = new URL(videoUrl);
    } catch (e) {
      return {
        isValid: false,
        error: 'URL inválida',
        details: { reason: 'malformed_url' }
      };
    }

    // Verificar que sea HTTPS (requerido por TikTok)
    if (url.protocol !== 'https:') {
      return {
        isValid: false,
        error: 'TikTok requiere URLs HTTPS',
        details: { reason: 'non_https_url', protocol: url.protocol }
      };
    }

    // Hacer una petición HEAD para verificar accesibilidad
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

    try {
      const response = await fetch(videoUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'TikTok-Video-Validator/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          isValid: false,
          error: `Video no accesible: HTTP ${response.status}`,
          details: {
            reason: 'http_error',
            status: response.status,
            statusText: response.statusText
          }
        };
      }

      // Verificar Content-Type
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');

      // Verificar que sea un video
      if (contentType && !contentType.startsWith('video/')) {
        return {
          isValid: false,
          error: `Tipo de contenido inválido: ${contentType}`,
          details: {
            reason: 'invalid_content_type',
            contentType
          }
        };
      }

      // Verificar tamaño del archivo (TikTok tiene límites)
      const maxSize = 4 * 1024 * 1024 * 1024; // 4GB límite de TikTok
      if (contentLength) {
        const size = parseInt(contentLength);
        if (size > maxSize) {
          return {
            isValid: false,
            error: `Video demasiado grande: ${(size / (1024 * 1024 * 1024)).toFixed(2)}GB (máximo 4GB)`,
            details: {
              reason: 'file_too_large',
              size,
              maxSize
            }
          };
        }
      }

      return {
        isValid: true,
        details: {
          contentType,
          contentLength: contentLength ? parseInt(contentLength) : null,
          url: videoUrl
        }
      };

    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        return {
          isValid: false,
          error: 'Timeout al verificar la URL (>10s)',
          details: { reason: 'timeout' }
        };
      }

      return {
        isValid: false,
        error: `Error de red: ${fetchError.message}`,
        details: {
          reason: 'network_error',
          message: fetchError.message
        }
      };
    }

  } catch (error) {
    return {
      isValid: false,
      error: `Error inesperado: ${error.message}`,
      details: {
        reason: 'unexpected_error',
        message: error.message
      }
    };
  }
}

/**
 * Verifica múltiples URLs de video
 * @param {string[]} videoUrls - Array de URLs a verificar
 * @returns {Promise<Array<{url: string, isValid: boolean, error?: string, details?: object}>>}
 */
export async function validateMultipleVideoUrls(videoUrls) {
  const results = await Promise.all(
    videoUrls.map(async (url) => {
      const result = await validateVideoUrl(url);
      return {
        url,
        ...result
      };
    })
  );

  return results;
}

/**
 * Obtiene información detallada de una URL de video
 * @param {string} videoUrl - URL del video
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getVideoUrlInfo(videoUrl) {
  try {
    const validation = await validateVideoUrl(videoUrl);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        details: validation.details
      };
    }

    // Hacer una petición HEAD más detallada
    const response = await fetch(videoUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'TikTok-Video-Validator/1.0'
      }
    });

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      success: true,
      data: {
        url: videoUrl,
        status: response.status,
        statusText: response.statusText,
        headers,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag'),
        server: response.headers.get('server'),
        isValid: true
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: { reason: 'fetch_error' }
    };
  }
}

/**
 * Verifica si una URL cumple con los requisitos específicos de TikTok
 * @param {string} videoUrl - URL del video
 * @returns {Promise<{compatible: boolean, issues: string[], recommendations: string[]}>}
 */
export async function checkTikTokCompatibility(videoUrl) {
  const issues = [];
  const recommendations = [];

  try {
    const url = new URL(videoUrl);
    
    // Verificar protocolo
    if (url.protocol !== 'https:') {
      issues.push('URL debe usar HTTPS');
      recommendations.push('Cambiar a HTTPS');
    }

    // Verificar dominio conocido problemático
    const problematicDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (problematicDomains.some(domain => url.hostname.includes(domain))) {
      issues.push('Dominio local no accesible desde TikTok');
      recommendations.push('Usar un dominio público accesible');
    }

    // Verificar accesibilidad
    const validation = await validateVideoUrl(videoUrl);
    if (!validation.isValid) {
      issues.push(validation.error);
      
      if (validation.details?.reason === 'timeout') {
        recommendations.push('Verificar que el servidor responda rápidamente');
      } else if (validation.details?.reason === 'http_error') {
        recommendations.push('Verificar que la URL sea accesible públicamente');
      }
    }

    return {
      compatible: issues.length === 0,
      issues,
      recommendations
    };

  } catch (error) {
    return {
      compatible: false,
      issues: [`Error verificando compatibilidad: ${error.message}`],
      recommendations: ['Verificar que la URL sea válida']
    };
  }
}