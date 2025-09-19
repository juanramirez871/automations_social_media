import { getValidTikTokToken } from './tiktokRefresh';

export async function getTikTokToken(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'tiktok_access_token, tiktok_expires_at, tiktok_open_id, tiktok_granted_scopes'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const token = data?.tiktok_access_token || null;
    const expiresAt = data?.tiktok_expires_at || null;
    const openId = data?.tiktok_open_id || null;
    const grantedScopes = data?.tiktok_granted_scopes || null;

    return { token, expiresAt, openId, grantedScopes };
  } catch (e) {
    return { token: null, expiresAt: null, openId: null, grantedScopes: null };
  }
}

export function normalizeVerifiedTikTokUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return inputUrl;
  }

  if (inputUrl.includes('res.cloudinary.com')) {
    return inputUrl.replace(
      /https:\/\/res\.cloudinary\.com\/[^/]+\//,
      'https://media.kaioficial.com/tiktok/cdn/'
    );
  }

  return inputUrl;
}

export async function getRemoteFileMeta(url) {
  let contentLength = null;
  let contentType = 'application/octet-stream';

  try {
    const head = await fetch(url, { method: 'HEAD' });

    if (head.ok) {
      const len = head.headers.get('content-length');
      const ctype = head.headers.get('content-type');

      if (len && !isNaN(Number(len))) contentLength = Number(len);
      if (ctype) contentType = ctype;
    }
  } catch { }

  return {
    contentLength: Number.isFinite(contentLength) ? contentLength : null,
    contentType,
  };
}

export async function tiktokInitFileUpload({
  token,
  mode,
  title,
  privacyLevel,
  videoUrl,
}) {
  const isDirect = mode === 'direct';
  const url = isDirect
    ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
    : 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
  const effectivePrivacy = privacyLevel || 'SELF_ONLY';

  const { contentLength, contentType } = await getRemoteFileMeta(videoUrl);

  const MIN_CHUNK_SIZE = 5 * 1024 * 1024;
  const MAX_CHUNK_SIZE = 64 * 1024 * 1024;

  let chunkSize, totalChunks;

  if (!contentLength || contentLength < MIN_CHUNK_SIZE) {
    chunkSize = contentLength || MIN_CHUNK_SIZE;
    totalChunks = 1;
  } else {
    if (contentLength < 20 * 1024 * 1024) {
      chunkSize = contentLength;
      totalChunks = 1;
    } else {
      chunkSize = 10 * 1024 * 1024;
      totalChunks = Math.floor(contentLength / chunkSize);
      if (contentLength % chunkSize > 0) {
        totalChunks += 1;
      }
    }
  }

  const body = isDirect
    ? {
      post_info: {
        title: (title || '').slice(0, 2200),
        privacy_level: effectivePrivacy,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: contentLength || 0,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks,
      },
    }
    : {
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: contentLength || 0,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks,
      },
    };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      responseData?.error?.message || 'Error inicializando subida de TikTok';

    throw new Error(errorMsg);
  }

  const publishId = responseData?.data?.publish_id;
  const uploadUrl = responseData?.data?.upload_url;

  if (!publishId || !uploadUrl) {
    throw new Error(
      'Respuesta init de TikTok no contiene publish_id o upload_url'
    );
  }

  return {
    publishId,
    uploadUrl,
    videoSize: contentLength,
    chunkSize,
    totalChunks,
    contentType,
  };
}

export async function tiktokUploadFromUrl({
  uploadUrl,
  videoUrl,
  videoSize,
  chunkSize,
  totalChunks,
  contentType,
}) {
  const videoResp = await fetch(videoUrl);

  if (!videoResp.ok || !videoResp.body) {
    throw new Error(`Error descargando video: ${videoResp.status}`);
  }

  if (totalChunks === 1 || !videoSize) {
    const headers = {
      'Content-Type': contentType || 'application/octet-stream',
    };

    if (videoSize) {
      headers['Content-Length'] = String(videoSize);
      headers['Content-Range'] = `bytes 0-${videoSize - 1}/${videoSize}`;
    }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: videoResp.body,
      duplex: 'half',
    });

    let putJson = {};

    try {
      putJson = await putRes.json();
    } catch { }
    if (!putRes.ok) {
      const msg =
        putJson?.error?.message || 'Falló la subida de video a TikTok';

      throw new Error(msg);
    }
  } else {
    const videoBuffer = await videoResp.arrayBuffer();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, videoSize);
      const chunk = videoBuffer.slice(start, end);

      const headers = {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${end - 1}/${videoSize}`,
      };

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers,
        body: chunk,
      });

      let putJson = {};

      try {
        putJson = await putRes.json();
      } catch { }
      if (!putRes.ok) {
        const msg =
          putJson?.error?.message || `Falló la subida del chunk ${i + 1}`;

        throw new Error(msg);
      }
    }
  }
}

export async function publishToTikTok({
  caption,
  videoUrl,
  userId,
  privacyLevel,
  supabase,
}) {
  try {
    console.log('Iniciando publicación en TikTok:', {
      userId,
      hasVideoUrl: !!videoUrl,
      captionLength: caption?.length || 0,
      captionPreview: caption?.substring(0, 50) + (caption?.length > 50 ? '...' : '')
    });

    if (!videoUrl) {
      throw new Error('TikTok requiere un video');
    }

    // Usar la nueva función que maneja el refresh automático
    const {
      token: ttToken,
      expiresAt: ttExpiresAt,
      openId,
      grantedScopes,
    } = await getValidTikTokToken(supabase, userId);

    if (!ttToken) {
      throw new Error('No hay token de TikTok configurado');
    }

    if (ttExpiresAt && new Date(ttExpiresAt) < new Date()) {
      throw new Error('Token de TikTok expirado');
    }

    const scopes = Array.isArray(grantedScopes)
      ? grantedScopes
      : typeof grantedScopes === 'string'
        ? grantedScopes.split(/[\s,]+/).filter(Boolean)
        : [];
    const hasDirectPost = scopes.includes('video.publish');
    const hasUpload = scopes.includes('video.upload');

    let publishId = null;
    let status = null;

    const pullUrl = normalizeVerifiedTikTokUrl(videoUrl);

    if (hasDirectPost) {
      let creatorInfo = null;

      try {
        const ciRes = await fetch(
          'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ttToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
          }
        );

        creatorInfo = await ciRes.json().catch(() => ({}));
      } catch (e) { }

      const options = creatorInfo?.data?.privacy_level_options;
      let effectivePrivacy = 'SELF_ONLY';

      if (
        privacyLevel &&
        Array.isArray(options) &&
        options.includes(privacyLevel)
      ) {
        effectivePrivacy = privacyLevel;
      }

      const title = (caption || '').slice(0, 2200);
      const initBody = {
        post_info: {
          title,
          privacy_level: effectivePrivacy,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: pullUrl,
        },
      };

      const initRes = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ttToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify(initBody),
        }
      );
      const initJson = await initRes.json().catch(() => ({}));

      if (!initRes.ok) {
        const errMsg = initJson?.error?.message || '';

        if (
          /URL ownership|ownership verification|pull_from_url|guidelines/i.test(
            errMsg
          )
        ) {
          try {
            const {
              publishId: upId,
              uploadUrl,
              videoSize,
              chunkSize,
              totalChunks,
              contentType,
            } = await tiktokInitFileUpload({
              token: ttToken,
              mode: 'direct',
              title,
              privacyLevel: effectivePrivacy,
              videoUrl,
            });

            await tiktokUploadFromUrl({
              uploadUrl,
              videoUrl,
              videoSize,
              chunkSize,
              totalChunks,
              contentType,
            });
            publishId = upId;
          } catch (e) {
            if (hasUpload) {
              const {
                publishId: upId,
                uploadUrl,
                videoSize,
                chunkSize,
                totalChunks,
                contentType,
              } = await tiktokInitFileUpload({
                token: ttToken,
                mode: 'inbox',
                videoUrl,
              });

              await tiktokUploadFromUrl({
                uploadUrl,
                videoUrl,
                videoSize,
                chunkSize,
                totalChunks,
                contentType,
              });
              publishId = upId;
            } else {
              throw e;
            }
          }
        } else {
          if (hasUpload) {
            const {
              publishId: upId,
              uploadUrl,
              videoSize,
              chunkSize,
              totalChunks,
              contentType,
            } = await tiktokInitFileUpload({
              token: ttToken,
              mode: 'inbox',
              videoUrl,
            });

            await tiktokUploadFromUrl({
              uploadUrl,
              videoUrl,
              videoSize,
              chunkSize,
              totalChunks,
              contentType,
            });
            publishId = upId;
          } else {
            throw new Error(
              errMsg ||
              'Error inicializando publicación en TikTok (Direct Post)'
            );
          }
        }
      } else {
        publishId = initJson?.data?.publish_id || null;
      }
    } else if (hasUpload) {
      const initBody = {
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: pullUrl,
        },
      };
      const initRes = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ttToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(initBody),
        }
      );
      const initJson = await initRes.json().catch(() => ({}));

      if (!initRes.ok) {
        const errMsg = initJson?.error?.message || '';

        if (
          /URL ownership|ownership verification|pull_from_url|guidelines/i.test(
            errMsg
          )
        ) {
          const {
            publishId: upId,
            uploadUrl,
            videoSize,
            chunkSize,
            totalChunks,
            contentType,
          } = await tiktokInitFileUpload({
            token: ttToken,
            mode: 'inbox',
            videoUrl,
          });

          await tiktokUploadFromUrl({
            uploadUrl,
            videoUrl,
            videoSize,
            chunkSize,
            totalChunks,
            contentType,
          });
          publishId = upId;
        } else {
          throw new Error(errMsg || 'Error subiendo video a TikTok (Inbox)');
        }
      } else {
        publishId = initJson?.data?.publish_id || null;
      }
    } else {
      throw new Error(
        'Permisos de TikTok insuficientes (requiere video.publish o video.upload)'
      );
    }

    if (publishId) {
      try {
        const statusRes = await fetch(
          'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ttToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({ publish_id: publishId }),
          }
        );
        const statusJson = await statusRes.json().catch(() => ({}));

        if (statusRes.ok) {
          status = statusJson?.data?.status || null;
        }
      } catch (e) { }
    }

    return {
      platform: 'tiktok',
      success: true,
      id: publishId,
      status,
    };
  } catch (error) {
    console.error('Error en publishToTikTok:', {
      error: error.message,
      stack: error.stack,
      userId,
      videoUrl: videoUrl ? 'presente' : 'ausente',
      caption: caption ? caption.substring(0, 50) + '...' : 'sin caption'
    });
    
    return {
      platform: 'tiktok',
      success: false,
      error: error.message,
    };
  }
}
