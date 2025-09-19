'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import IntroHeader from '@/components/IntroHeader';
import AssistantMessage from '@/components/AssistantMessage';
import UserMessage from '@/components/UserMessage';
import Composer from '@/components/Composer';
import { supabase } from '@/lib/supabaseClient';
import {
  AuthGateWidget as AuthGateWidgetExt,
  AuthFormWidget as AuthFormWidgetExt,
} from '@/components/widgets/AuthWidgets';
import {
  InstagramAuthWidget as InstagramAuthWidgetExt,
  InstagramConnectedWidget as InstagramConnectedWidgetExt,
} from '@/components/widgets/InstagramWidgets';
import {
  FacebookAuthWidget as FacebookAuthWidgetExt,
  FacebookConnectedWidget as FacebookConnectedWidgetExt,
} from '@/components/widgets/FacebookWidgets';
import {
  YouTubeAuthWidget as YouTubeAuthWidgetExt,
  YouTubeConnectedWidget as YouTubeConnectedWidgetExt,
} from '@/components/widgets/YouTubeWidgets';
import {
  TikTokAuthWidget as TikTokAuthWidgetExt,
  TikTokConnectedWidget as TikTokConnectedWidgetExt,
} from '@/components/widgets/TikTokWidgets';
import {
  LogoutWidget as LogoutWidgetExt,
  ClearChatWidget as ClearChatWidgetExt,
  PlatformsWidget as PlatformsWidgetExt,
  PostPublishWidget as PostPublishWidgetExt,
} from '@/components/widgets/ControlWidgets';
import {
  CaptionSuggestWidget as CaptionSuggestWidgetExt,
  ScheduleWidget as ScheduleWidgetExt,
} from '@/components/widgets/ControlWidgets';
import AIProviderConfigWidget from '@/components/widgets/AIProviderConfigWidget';
import {
  upsertInstagramToken,
  upsertFacebookToken,
  upsertYouTubeToken,
  upsertTikTokToken,
} from '@/lib/apiHelpers';
import {
  saveMessageToDB,
  loadHistoryForCurrentUser,
} from '@/lib/databaseUtils';
import { getSessionOnce, clearSessionCache } from '@/lib/sessionUtils';
import {
  detectNewPublishIntent,
  detectCancelIntent,
  newId,
  createCancelMessage,
  createNeedMediaMessage,
  createNeedDescriptionMessage,
} from '@/lib/publishFlowUtils';
import { useChatState } from '@/hooks/useChatState';
import { 
  checkPlatformConfiguration, 
  createConfigurationErrorMessage 
} from '@/lib/platformConfigChecker';

export default function Home() {
  const {
    messages,
    setMessages,
    loading,
    setLoading,
    historyLoading,
    setHistoryLoading,
    isLoggedIn,
    setIsLoggedIn,
    lightbox,
    setLightbox,
    publishStage,
    setPublishStage,
    publishTargets,
    setPublishTargets,
    widgetTargetDrafts,
    setWidgetTargetDrafts,
    customCaptionMode,
    setCustomCaptionMode,
    authGateShownRef,
    bottomRef,
    initialScrollDoneRef,
    disableSmoothUntilRef,
    resetPublishFlow,
    onAttachmentClick,
    closeLightbox,
  } = useChatState();
  const igConnectPersistingRef = useRef(false);

  // Subir archivo directamente a Cloudinary (sin pasar por Vercel)
  const uploadToCloudinary = async (
    file,
    { folder = 'ui-chat-uploads' } = {}
  ) => {
    try {
      // Validación del lado del cliente para archivos grandes
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB - sin límites de Vercel
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`El archivo "${file.name}" es demasiado grande. Tamaño máximo: 100MB. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // Obtener firma de Cloudinary
      const signatureResponse = await fetch('/api/cloudinary-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });

      if (!signatureResponse.ok) {
        throw new Error('Error al obtener la firma de Cloudinary');
      }

      const { signature, timestamp, cloud_name, api_key, folder: signatureFolder } = await signatureResponse.json();

      // Crear FormData para upload directo a Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp);
      formData.append('api_key', api_key);
      formData.append('folder', signatureFolder);

      // Upload directo a Cloudinary
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Upload failed: ${uploadResponse.status}`);
      }

      const result = await uploadResponse.json();
      return {
        secureUrl: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
      };
    } catch (e) {
      console.error('Error uploading file:', e.message);
      throw e; // Re-lanzar el error para que sea manejado por el código que llama
    }
  };

  // Helper: cargar historial para el usuario autenticado desde DB y mapear al formato UI
  const loadHistoryAndNormalize = async () => {
    try {
      setHistoryLoading(true);
      const { data: sessionData } = await getSessionOnce();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const rows = await loadHistoryForCurrentUser(userId);

      let restoreTargets = null;
      let sawAwaitMedia = false;
      let hasPublishResult = false;
      const draftsByWidget = {};

      const normalized = (rows || [])
        .map(r => {
          const rType =
            r.type ||
            (r.role === 'user'
              ? Array.isArray(r.attachments) && r.attachments.length
                ? 'text+media'
                : 'text'
              : 'text');

          // Render según type almacenado
          if (r.role === 'assistant') {
            if (rType === 'widget-platforms') {
              return { id: r.id, role: 'assistant', type: 'widget-platforms' };
            }
            if (rType === 'widget-post-publish') {
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-post-publish',
                widgetKey: r?.meta?.widgetKey,
              };
            }
            if (rType === 'widget-await-media') {
              const targets = Array.isArray(r?.meta?.targets)
                ? r.meta.targets
                : null;
              if (targets) {
                // Guardar SIEMPRE la última selección para restaurar tras recarga (flujo global)
                restoreTargets = targets;
              }
              sawAwaitMedia = true;
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-await-media',
                meta: targets ? { targets } : undefined,
              };
            }
            if (rType === 'internal-targets') {
              // Mensaje interno para restaurar targets; ahora también soporta drafts por widget
              try {
                let parsed = null;
                if (typeof r.content === 'string' && r.content.trim()) {
                  parsed = JSON.parse(r.content);
                } else if (r?.meta?.targets) {
                  parsed = { targets: r.meta.targets };
                }
                const t = Array.isArray(parsed)
                  ? parsed
                  : Array.isArray(parsed?.targets)
                    ? parsed.targets
                    : null;
                const key =
                  parsed?.widgetKey ||
                  parsed?.widgetId ||
                  r?.meta?.widgetKey ||
                  r?.meta?.widgetId ||
                  null;
                if (key && t) {
                  draftsByWidget[key] = t;
                }
                if (t) restoreTargets = t; // Mantener la última selección
              } catch (_) { }
              return null; // No renderizar en UI
            }
            if (rType === 'internal-schedule') {
              // Mensaje interno para almacenar el horario de publicación. No debe mostrarse en el chat.
              return null; // No renderizar en UI
            }
            if (rType === 'internal-publish-result') {
              // Mensaje interno que indica que ya se completó una publicación exitosamente
              hasPublishResult = true;
              return null; // No renderizar en UI
            }
            if (rType === 'widget-auth-gate') {
              return { id: r.id, role: 'assistant', type: 'widget-auth-gate' };
            }
            if (rType === 'widget-auth-form') {
              return { id: r.id, role: 'assistant', type: 'widget-auth-form' };
            }
            if (rType === 'widget-instagram-credentials') {
              // Compatibilidad retro: mapear al nuevo flujo OAuth unificado
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-instagram-auth',
              };
            }
            if (rType === 'widget-instagram-auth') {
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-instagram-auth',
              };
            }
            if (rType === 'widget-instagram-configured') {
              const name = r?.meta?.name || null;
              const id = r?.meta?.id || null;
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-instagram-configured',
                name,
                igId: id,
              };
            }
            if (rType === 'widget-instagram-connected') {
              const username = r?.meta?.username || r?.meta?.name || null;
              const igId = r?.meta?.igId || r?.meta?.id || null;
              const expiresAt = r?.meta?.expiresAt || null;
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-instagram-connected',
                username,
                igId,
                expiresAt,
              };
            }
            if (rType === 'widget-facebook-auth') {
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-facebook-auth',
              };
            }
            if (rType === 'widget-facebook-connected') {
              const fbId = r?.meta?.fbId || null;
              const name = r?.meta?.name || null;
              const scopes = r?.meta?.scopes || null;
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-facebook-connected',
                fbId,
                name,
                scopes,
              };
            }
            if (rType === 'widget-youtube-auth') {
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-youtube-auth',
              };
            }
            if (rType === 'widget-youtube-connected') {
              const channelId = r?.meta?.channelId || null;
              const channelTitle = r?.meta?.channelTitle || null;
              const grantedScopes = r?.meta?.grantedScopes || null;
              const expiresAt = r?.meta?.expiresAt || null;
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-youtube-connected',
                meta: { channelId, channelTitle, grantedScopes, expiresAt },
              };
            }
            if (rType === 'widget-tiktok-auth') {
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-tiktok-auth',
              };
            }
            if (rType === 'widget-tiktok-connected') {
              const openId = r?.meta?.openId || null;
              const grantedScopes = r?.meta?.grantedScopes || null;
              const expiresAt = r?.meta?.expiresAt || null;
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-tiktok-connected',
                meta: { openId, grantedScopes, expiresAt },
              };
            }
            if (rType === 'widget-logout') {
              return { id: r.id, role: 'assistant', type: 'widget-logout' };
            }
            if (rType === 'widget-clear-chat') {
              return { id: r.id, role: 'assistant', type: 'widget-clear-chat' };
            }
            if (rType === 'widget-calendar') {
              return { id: r.id, role: 'assistant', type: 'widget-calendar' };
            }
            if (rType === 'widget-caption-suggest') {
              const caption = r?.meta?.caption || '';
              const base = r?.meta?.base || '';
              const targets = Array.isArray(r?.meta?.targets)
                ? r.meta.targets
                : [];
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-caption-suggest',
                meta: { caption, base, targets },
              };
            }
            if (rType === 'widget-schedule') {
              const defaultValue =
                r?.meta?.defaultValue || r?.meta?.value || null;
              return {
                id: r.id,
                role: 'assistant',
                type: 'widget-schedule',
                meta: { defaultValue },
              };
            }

            return {
              id: r.id,
              role: 'assistant',
              type: 'text',
              content: r.content,
            };
          }

          // Usuario
          if (rType === 'text+media') {
            const att = Array.isArray(r.attachments) ? r.attachments : [];
            const mapped = att
              .map(a => {
                const isVideo = a.kind === 'video';
                const url = a.url || a.secureUrl || null;
                if (!url) return null;
                return {
                  kind: isVideo ? 'video' : 'image',
                  url,
                  name: a.name || undefined,
                };
              })
              .filter(Boolean);
            return {
              id: r.id,
              role: 'user',
              type: 'text',
              text: r.content || '',
              attachments: mapped,
            };
          }
          return {
            id: r.id,
            role: 'user',
            type: 'text',
            text: r.content || '',
            attachments: [],
          };
        })
        .filter(Boolean);

      // Analizar stage por contenido de mensajes
      let lastAskDescIndex = -1;
      for (let i = 0; i < normalized.length; i++) {
        const m = normalized[i];
        if (
          m.role === 'assistant' &&
          m.type === 'text' &&
          typeof m.content === 'string' &&
          m.content.startsWith('Paso 3:')
        ) {
          lastAskDescIndex = i;
        }
      }
      let finalSummaryAfter = false;
      if (lastAskDescIndex >= 0) {
        for (let j = lastAskDescIndex + 1; j < normalized.length; j++) {
          const m = normalized[j];
          if (
            m.role === 'assistant' &&
            m.type === 'text' &&
            /El flujo termina aquí por ahora\./i.test(m.content || '')
          ) {
            finalSummaryAfter = true;
            break;
          }
        }
      }

      // Desduplicar widgets únicos conservando el último
      const uniqueTypes = new Set([
        'widget-post-publish',
        'widget-await-media',
      ]);
      const seenUnique = new Set();
      const deduped = [];
      for (let i = normalized.length - 1; i >= 0; i--) {
        const m = normalized[i];
        if (m.role === 'assistant' && uniqueTypes.has(m.type)) {
          if (seenUnique.has(m.type)) continue;
          seenUnique.add(m.type);
        }
        deduped.unshift(m);
      }

      // setMessages(deduped); // deshabilitado: siempre mostrar todos los widgets

      // Mostrar todos los widgets sin desduplicación
      setMessages(normalized);

      // Fallback: si hay targets guardados pero no existe draft ligado por widgetId (p. ej. porque se guardó con un id temporal),
      // asignar esos targets al último widget-post-publish para que se restaure tras recargar.
      const lastPostPublish = (() => {
        for (let i = normalized.length - 1; i >= 0; i--) {
          const m = normalized[i];
          if (m.role === 'assistant' && m.type === 'widget-post-publish')
            return m;
        }
        return null;
      })();
      if (
        lastPostPublish &&
        restoreTargets &&
        !draftsByWidget[lastPostPublish.widgetKey || lastPostPublish.id]
      ) {
        draftsByWidget[lastPostPublish.widgetKey || lastPostPublish.id] =
          restoreTargets;
      }

      // Detectar si hubo una cancelación después del último widget de flujo activo
      let wasCancelled = false;
      const lastFlowWidgetIndex = Math.max(
        normalized.findLastIndex(m => m.role === 'assistant' && m.type === 'widget-await-media'),
        lastAskDescIndex
      );
      
      if (lastFlowWidgetIndex >= 0) {
        // Buscar mensaje de cancelación después del último widget de flujo
        for (let i = lastFlowWidgetIndex + 1; i < normalized.length; i++) {
          const m = normalized[i];
          if (
            m.role === 'assistant' &&
            m.type === 'text' &&
            typeof m.content === 'string' &&
            m.content.includes('cancelé el flujo de publicación')
          ) {
            wasCancelled = true;
            break;
          }
        }
      }

      // Restaurar estado del flujo SOLO si no hay resultado de publicación exitosa y no fue cancelado
      if (hasPublishResult || wasCancelled) {
        // Si ya se publicó exitosamente o fue cancelado, mantener el flujo en idle
        setPublishStage('idle');
      } else if (lastAskDescIndex >= 0 && !finalSummaryAfter) {
        setPublishStage('await-description');
      } else if (sawAwaitMedia && lastAskDescIndex < 0) {
        setPublishStage('await-media');
      } else {
        setPublishStage('idle');
      }
      if (
        restoreTargets &&
        Array.isArray(restoreTargets) &&
        !hasPublishResult &&
        !wasCancelled
      ) {
        setPublishTargets(restoreTargets);
      } else {
        setPublishTargets([]); // Limpiar targets si ya se completó el flujo o fue cancelado
      }
      setWidgetTargetDrafts(draftsByWidget);
      setIsLoggedIn(true);
    } catch (e) {
    } finally {
      setHistoryLoading(false);
    }
  };
  const handleSend = async ({ text, files }) => {
    if (!supabase) {
      if (!isLoggedIn && !authGateShownRef.current) {
        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}-auth-gate`,
            role: 'assistant',
            type: 'widget-auth-gate',
          },
        ]);
        authGateShownRef.current = true;
      }
      return;
    }

    const { data: sessionData } = await getSessionOnce();
    const hasSession = Boolean(sessionData?.session);
    if (!hasSession) {
      if (!authGateShownRef.current) {
        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}-auth-gate`,
            role: 'assistant',
            type: 'widget-auth-gate',
          },
        ]);
        authGateShownRef.current = true;
      }
      return;
    }
    const userId = sessionData?.session?.user?.id;

    // Validar archivos antes de subir a Cloudinary si estamos en await-media
    if (
      Array.isArray(files) &&
      files.length > 0 &&
      publishStage === 'await-media'
    ) {
      const hasVideoOnlyPlatforms = publishTargets.some(
        p => p === 'youtube' || p === 'tiktok'
      );
      const hasImages = files.some(f => {
        const isImage =
          f.type?.startsWith('image/') ||
          /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
        return isImage;
      });
      const hasVideos = files.some(f => {
        const isVideo =
          f.type?.startsWith('video/') ||
          /\.(mp4|mov|webm|ogg|mkv|m4v)$/i.test(f.name);
        return isVideo;
      });

      if (hasVideoOnlyPlatforms && hasImages && !hasVideos) {
        const videoOnlyPlatforms = publishTargets.filter(
          p => p === 'youtube' || p === 'tiktok'
        );
        const platformNames = videoOnlyPlatforms
          .map(p => (p === 'youtube' ? 'YouTube' : 'TikTok'))
          .join(' y ');
        setMessages(prev => [
          ...prev,
          {
            id: newId('video-required'),
            role: 'assistant',
            type: 'text',
            content: `❌ **Error:** ${platformNames} solo acepta videos, no imágenes.\n\nsube un video (MP4, MOV, WEBM) para continuar.`,
          },
        ]);
        return;
      }
    }

    // Subir adjuntos a Cloudinary antes de construir el mensaje
    let uploadedAttachments = [];
    if (Array.isArray(files) && files.length > 0) {
      setLoading(true);
      try {
        const uploads = [];
        for (const f of files) {
          uploads.push(
            (async () => {
              try {
                const isVideo =
                  f.type?.startsWith('video/') ||
                  /(\.(mp4|mov|webm|ogg|mkv|m4v))$/i.test(f.name || '');
                const kind = isVideo ? 'video' : 'image';
                const res = await uploadToCloudinary(f);
                if (res?.secureUrl) {
                  return {
                    kind,
                    url: res.secureUrl,
                    publicId: res.publicId,
                    name: f.name,
                  };
                } else {
                  return null;
                }
              } catch (error) {
                // Mostrar error específico del archivo
                setMessages(prev => [
                  ...prev,
                  {
                    id: newId('upload-error'),
                    role: 'assistant',
                    type: 'text',
                    content: `❌ **Error al subir archivo:** ${error.message}`,
                  },
                ]);
                return null;
              }
            })()
          );
        }
        const results = await Promise.all(uploads);
        uploadedAttachments = results.filter(Boolean);
        
        // Si no se pudo subir ningún archivo, detener el proceso
        if (files.length > 0 && uploadedAttachments.length === 0) {
          setLoading(false);
          return;
        }
      } catch (error) {
        setLoading(false);
        setMessages(prev => [
          ...prev,
          {
            id: newId('upload-error'),
            role: 'assistant',
            type: 'text',
            content: `❌ **Error general en la subida:** ${error.message}`,
          },
        ]);
        return;
      }
      setLoading(false);
    }

    // 1) Agregar el mensaje del usuario a la UI y guardar en DB
    const trimmed = (text || '').trim();
    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      type: uploadedAttachments.length ? 'text+media' : 'text',
      text: text || '',
      attachments: uploadedAttachments,
    };
    setMessages(prev => [...prev, userMessage]);

    const attachmentsForDB = uploadedAttachments.map(
      ({ kind, url, publicId, name }) => ({ kind, url, publicId, name })
    );
    await saveMessageToDB({
      userId,
      role: 'user',
      content: trimmed,
      attachments: attachmentsForDB,
      type: uploadedAttachments.length ? 'text+media' : 'text',
    });

    // Detectar si el usuario quiere iniciar un nuevo flujo de publicación explícitamente
    const wantsNewPublish = detectNewPublishIntent(trimmed);
    if (wantsNewPublish) {
      // Reiniciar completamente el flujo de publicación
      resetPublishFlow();
      
      // Mostrar mensaje de confirmación de reinicio y selector de plataformas
      const restartMessage = {
        id: newId('restart-flow'),
        role: 'assistant',
        type: 'text',
        content: 'Perfecto, empecemos con un nuevo post. Paso 1: Selecciona las plataformas donde quieres publicar.',
      };
      
      const platformsWidget = {
        id: newId('platforms-widget'),
        role: 'assistant',
        type: 'widget-post-publish',
      };
      
      setMessages(prev => [...prev, restartMessage, platformsWidget]);
      
      if (userId) {
        await saveMessageToDB({
          userId,
          role: 'assistant',
          content: restartMessage.content,
          attachments: null,
          type: 'text',
        });
        await saveMessageToDB({
          userId,
          role: 'assistant',
          content: '',
          attachments: null,
          type: 'widget-post-publish',
        });
      }
      return;
    }

    // Intención de cancelar el flujo de publicación actual
    const wantsCancelPublish = detectCancelIntent(trimmed);
    if (publishStage !== 'idle' && wantsCancelPublish) {
      // Romper el flujo de publicación solo si el usuario expresa cancelación
      const confirm = createCancelMessage();
      resetPublishFlow();
      setMessages(prev => [...prev, confirm]);
      await saveMessageToDB({
        userId,
        role: 'assistant',
        content: confirm.content,
        attachments: null,
        type: 'text',
      });
      return;
    }

    // Flujo de publicación lineal: aplicar gating según etapa (solo si no se solicitó reiniciar)
    if (!wantsNewPublish && publishStage === 'await-media') {
      if (uploadedAttachments.length === 0) {
        setMessages(prev => [
          ...prev,
          {
            id: newId('need-media'),
            role: 'assistant',
            type: 'text',
            content:
              'Necesito que adjuntes al menos una imagen o video para continuar.',
          },
        ]);
        return;
      } else {
        setPublishStage('await-description');
        setCustomCaptionMode(false);
        const step3 = {
          id: newId('ask-description'),
          role: 'assistant',
          type: 'text',
          content: 'Paso 3: Ahora escribe la descripción para el post.',
        };
        setMessages(prev => [...prev, step3]);
        await saveMessageToDB({
          userId,
          role: 'assistant',
          content: step3.content,
          attachments: null,
          type: 'text',
        });
        return;
      }
    }

    if (!wantsNewPublish && publishStage === 'await-description') {
      if (!trimmed) {
        setMessages(prev => [
          ...prev,
          {
            id: newId('need-description'),
            role: 'assistant',
            type: 'text',
            content:
              'Por favor escribe la descripción del post para continuar.',
          },
        ]);
        return;
      } else {
        // Si el usuario eligió "Escribir la mía", tomar su siguiente mensaje como final
        if (customCaptionMode) {
          const targets = (publishTargets || []).join(', ');
          const finalMsg = `Perfecto. Redes: ${targets || '—'}. Descripción final:\n${trimmed}`;
          const schedulePreface = {
            id: newId('schedule-preface-user'),
            role: 'assistant',
            type: 'text',
            content:
              'Paso final: agenda la subida del post. Indica la fecha y hora.',
          };
          const scheduleWidget = {
            id: newId('schedule-widget-user'),
            role: 'assistant',
            type: 'widget-schedule',
            meta: { defaultValue: null },
          };
          setMessages(prev => [
            ...prev,
            {
              id: newId('caption-final-user'),
              role: 'assistant',
              type: 'text',
              content: finalMsg,
            },
            schedulePreface,
            scheduleWidget,
          ]);
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: finalMsg,
            attachments: null,
            type: 'text',
          });
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: schedulePreface.content,
            attachments: null,
            type: 'text',
          });
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: '',
            attachments: null,
            type: 'widget-schedule',
            meta: { defaultValue: null },
          });
          setPublishStage('idle');
          setCustomCaptionMode(false);
          return;
        }
        // Generar una descripción profesional en base al texto del usuario
        const targetsArr = publishTargets || [];
        const targets = targetsArr.join(', ');
        const prompt = `Genera una descripción profesional y atractiva en español para redes sociales, con base en este texto del usuario. Requisitos: 2-4 líneas, tono natural y claro, 2-5 hashtags relevantes (sin exceso), 0-2 emojis discretos, incluir un CTA sutil si aplica. Devuelve solo el texto final del caption. Contexto de plataformas: ${targets || 'generales'}. Texto base: ${trimmed}`;
        try {
          setLoading(true);
          const { data: sessionData } = await getSessionOnce();
          const userId = sessionData?.session?.user?.id;
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'caption',
              prompt: `${trimmed}\nPlataformas destino: ${targets || 'generales'}`,
              userId: userId,
            }),
          });
          const data = await res.json();
          const suggestion = (data?.text || '').trim();
          const preface = {
            id: newId('caption-preface'),
            role: 'assistant',
            type: 'text',
            content: `Perfecto. Redes: ${targets || '—'}. Te propongo esta descripción:`,
          };
          const capMeta = {
            caption: suggestion || trimmed,
            base: trimmed,
            targets: targetsArr,
          };
          const capWidget = {
            id: newId('caption-suggest'),
            role: 'assistant',
            type: 'widget-caption-suggest',
            meta: capMeta,
          };
          setMessages(prev => [...prev, preface, capWidget]);
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: preface.content,
            attachments: null,
            type: 'text',
          });
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: '',
            attachments: null,
            type: 'widget-caption-suggest',
            meta: capMeta,
          });
          setLoading(false);
          // Nos mantenemos en await-description para permitir "regenerar" o "escribir la mía".
          return;
        } catch (e) {
          setLoading(false);
          const fallback = `Perfecto. Redes: ${targets || '—'}. Usa esta descripción o edítala: ${trimmed}`;
          const schedulePreface = {
            id: newId('schedule-preface-fallback'),
            role: 'assistant',
            type: 'text',
            content:
              'Paso final: agenda la subida del post. Indica la fecha y hora.',
          };
          const scheduleWidget = {
            id: newId('schedule-widget-fallback'),
            role: 'assistant',
            type: 'widget-schedule',
            meta: { defaultValue: null },
          };
          setMessages(prev => [
            ...prev,
            {
              id: newId('caption-fallback'),
              role: 'assistant',
              type: 'text',
              content: fallback,
            },
            schedulePreface,
            scheduleWidget,
          ]);
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: fallback,
            attachments: null,
            type: 'text',
          });
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: schedulePreface.content,
            attachments: null,
            type: 'text',
          });
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: '',
            attachments: null,
            type: 'widget-schedule',
            meta: { defaultValue: null },
          });
          setPublishStage('idle');
          setCustomCaptionMode(false);
          return;
        }
      }
    }

    // La detección de intención para publicar la decide el modelo mediante tools (showPostPublishSelection)

    // Desde aquí en adelante, ya no se hace detección manual de intención.
    // En su lugar, se envía el mensaje al endpoint /api/chat el cual decide qué widgets mostrar vía tools
    if (trimmed) {
      setLoading(true);
      try {
        const { data: sessionData } = await getSessionOnce();
        const userId = sessionData?.session?.user?.id;
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: trimmed }],
            userId: userId,
          }),
        });
        const data = await res.json();
        const assistantText = data?.text || '';

        const additions = [];
        if (assistantText) {
          additions.push({
            id: `a-${Date.now()}-t`,
            role: 'assistant',
            type: 'text',
            content: assistantText,
          });
        }

        const widgets = Array.isArray(data?.widgets)
          ? data.widgets
          : data?.widget
            ? [data.widget]
            : [];

        const widgetTypeMap = {
          platforms: 'widget-platforms',
          'post-publish': 'widget-post-publish',
          'caption-suggest': 'widget-caption-suggest',
          'instagram-auth': 'widget-instagram-auth',
          'facebook-auth': 'widget-facebook-auth',
          'youtube-auth': 'widget-youtube-auth',
          'tiktok-auth': 'widget-tiktok-auth',
          logout: 'widget-logout',
          'clear-chat': 'widget-clear-chat',
          calendar: 'widget-calendar',
          'ai_provider_config': 'widget-ai-provider-config',
        };

        const widgetAdditionsMeta = [];
        for (const w of widgets) {
          const t = widgetTypeMap[w];
          if (t) {
            const widgetKey = newId('wkey');
            additions.push({
              id: newId(`w-${w}`),
              role: 'assistant',
              type: t,
              widgetKey,
            });
            widgetAdditionsMeta.push({ type: t, widgetKey });
          }
        }

        // Asegurar que nunca se vea el indicador de "escribiendo" junto con la respuesta
        setLoading(false);
        setMessages(prev => [...prev, ...additions]);

        // Guardar respuesta del asistente y widgets en DB
        if (assistantText) {
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: assistantText,
            attachments: null,
            type: 'text',
          });
        }
        for (const wm of widgetAdditionsMeta) {
          await saveMessageToDB({
            userId,
            role: 'assistant',
            content: '',
            attachments: null,
            type: wm.type,
            meta: { widgetKey: wm.widgetKey },
          });
        }
      } catch (e) {
        // Apagar el indicador antes de mostrar el mensaje de error
        setLoading(false);
        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            type: 'text',
            content: 'Hubo un error obteniendo la respuesta.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    } else {
      // Si no hay texto (p. ej. solo adjuntos) y no llamamos al chat, apagamos el indicador.
      setLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (!bottomRef.current) return;
    const firstNotDone = !initialScrollDoneRef.current;
    const shouldForceAuto =
      firstNotDone ||
      historyLoading ||
      Date.now() < disableSmoothUntilRef.current;
    bottomRef.current.scrollIntoView({
      behavior: shouldForceAuto ? 'auto' : 'smooth',
    });
    if (firstNotDone && !historyLoading && messages.length > 0) {
      initialScrollDoneRef.current = true;
    }
  }, [messages, loading, historyLoading]);

  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) {
        setIsLoggedIn(false);
        if (!authGateShownRef.current) {
          setMessages(prev => [
            ...prev,
            {
              id: `a-${Date.now()}-auth-gate`,
              role: 'assistant',
              type: 'widget-auth-gate',
            },
          ]);
          authGateShownRef.current = true;
        }
        return;
      }
      const { data } = await getSessionOnce();
      const hasSession = Boolean(data?.session);
      if (hasSession) {
        await loadHistoryAndNormalize();
      } else {
        setIsLoggedIn(false);
        if (!authGateShownRef.current) {
          setMessages(prev => [
            ...prev,
            {
              id: `a-${Date.now()}-auth-gate`,
              role: 'assistant',
              type: 'widget-auth-gate',
            },
          ]);
          authGateShownRef.current = true;
        }
      }
    };
    checkSession();
  }, []);

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-50 via-white to-pink-50 px-4 sm:px-6 lg:px-8 text-gray-600'>
      <div className='max-w-4xl mx-auto'>
        <IntroHeader />

        <ul className='mt-16 space-y-5'>
          {historyLoading && (
            <li className='flex justify-center' aria-live='polite'>
              <div className='inline-flex items-center gap-3 rounded-full px-4 py-2 bg-white/80 backdrop-blur border border-blue-100 shadow-sm'>
                <span className='relative inline-flex'>
                  <span className='size-5 rounded-full border-2 border-blue-300 border-t-transparent animate-spin'></span>
                </span>
                <span className='text-sm font-medium bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent'>
                  Cargando tus mensajes…
                </span>
              </div>
            </li>
          )}
          {messages.map(m => {
            if (m.role === 'assistant') {
              if (m.type === 'widget-platforms') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-blue-200'>
                    <PlatformsWidgetExt />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-auth-gate') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-blue-200'>
                    <AuthGateWidgetExt
                      onOpen={mode => {
                        setMessages(prev => [
                          ...prev,
                          {
                            id: `a-${Date.now()}-auth-${mode}`,
                            role: 'assistant',
                            type: 'widget-auth-form',
                            mode,
                          },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-auth-form') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-blue-200'>
                    <AuthFormWidgetExt
                      mode={m.mode}
                      onLogin={async ({
                        mode,
                        name,
                        email,
                        pass,
                        aiModel,
                        apiKey,
                      }) => {
                        if (supabase) {
                          try {
                            if (mode === 'signup') {
                              const { data: authData, error } =
                                await supabase.auth.signUp({
                                  email,
                                  password: pass,
                                  options: { data: { name } },
                                });
                              if (error) throw error;

                              // Guardar configuración de IA en el perfil
                              if (authData?.user?.id && aiModel && apiKey) {
                                const { error: profileError } = await supabase
                                  .from('profiles')
                                  .update({
                                    ai_model: aiModel,
                                    ai_api_key: apiKey,
                                  })
                                  .eq('id', authData.user.id);
                                if (profileError)
                                  console.warn(
                                    'Error guardando configuración de IA:',
                                    profileError
                                  );
                              }
                            } else {
                              const { error } =
                                await supabase.auth.signInWithPassword({
                                  email,
                                  password: pass,
                                });
                              if (error) throw error;
                            }
                            // Refrescar caché de sesión para evitar sesiones nulas cacheadas
                            clearSessionCache();
                            if (
                              typeof window !== 'undefined' &&
                              window.__session_cache_once
                            ) {
                              try {
                                delete window.__session_cache_once;
                              } catch { }
                            }
                            const { data: freshSession } =
                              await getSessionOnce();
                            setIsLoggedIn(Boolean(freshSession?.session));
                            // Limpiar widgets de auth de la UI
                            setMessages(prev =>
                              prev.filter(
                                mm =>
                                  mm.type !== 'widget-auth-gate' &&
                                  mm.type !== 'widget-auth-form'
                              )
                            );

                            await loadHistoryAndNormalize();
                            setMessages(prev => [
                              ...prev,
                              {
                                id: `a-${Date.now()}-auth-ok`,
                                role: 'assistant',
                                type: 'text',
                                content: 'Ingreso exitoso 🥳.',
                              },
                            ]);
                            return;
                          } catch (err) {
                            throw err;
                          }
                        }
                        setMessages(prev => [
                          ...prev,
                          {
                            id: `a-${Date.now()}-auth-submitted`,
                            role: 'assistant',
                            type: 'text',
                            content: `Formulario de ${mode === 'login' ? 'inicio de sesión' : 'creación de cuenta'} recibido (demo).`,
                          },
                        ]);
                      }}
                      onError={err => {
                        setMessages(prev => [
                          ...prev,
                          {
                            id: `a-${Date.now()}-auth-error`,
                            role: 'assistant',
                            type: 'text',
                            content: `Error de autenticación: ${err?.message || err}`,
                          },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (
                m.type === 'widget-instagram-credentials' ||
                m.type === 'widget-instagram-auth'
              ) {
                return (
                  <AssistantMessage key={m.id} borderClass='border-fuchsia-200'>
                    <InstagramAuthWidgetExt
                      widgetId={m.id}
                      onConnected={async payload => {
                        if (igConnectPersistingRef.current) return;
                        igConnectPersistingRef.current = true;
                        try {
                          const access_token = payload?.access_token;
                          const expires_in = payload?.expires_in;
                          const user = payload?.user || {};

                          const expiresAt = expires_in
                            ? new Date(
                              Date.now() + Number(expires_in) * 1000
                            ).toISOString()
                            : null;
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) throw new Error('Sesión inválida');

                          const ok = await upsertInstagramToken({
                            userId,
                            token: access_token,
                            expiresAt,
                            igUserId: user?.id || null,
                            igUsername: user?.username || null,
                            grantedScopes: null,
                          });

                          if (!ok)
                            throw new Error(
                              'No fue posible guardar el token de Instagram'
                            );
                          const connected = {
                            id: `a-${Date.now()}-ig-ok`,
                            role: 'assistant',
                            type: 'widget-instagram-connected',
                            username: user?.username || null,
                            igId: user?.id || null,
                            expiresAt,
                          };

                          setMessages(prev => {
                            const filtered = prev.filter(
                              mm => mm.type !== 'widget-instagram-connected'
                            );
                            return [...filtered, connected];
                          });

                          // NUEVO: asegurar unicidad en DB (dejar solo uno por usuario)
                          try {
                            await supabase
                              .from('messages')
                              .delete()
                              .eq('user_id', userId)
                              .eq('type', 'widget-instagram-connected');
                          } catch (_) { }

                          const dbResult = await saveMessageToDB({
                            userId,
                            role: 'assistant',
                            content: '',
                            attachments: null,
                            type: 'widget-instagram-connected',
                            meta: {
                              username: connected.username,
                              igId: connected.igId,
                              expiresAt: connected.expiresAt,
                            },
                          });
                        } catch (err) {
                          setMessages(prev => [
                            ...prev,
                            {
                              id: `a-${Date.now()}-ig-error`,
                              role: 'assistant',
                              type: 'text',
                              content: `Instagram OAuth error: ${err?.message || err}`,
                            },
                          ]);
                        } finally {
                          igConnectPersistingRef.current = false;
                        }
                      }}
                      onError={reason => {
                        setMessages(prev => [
                          ...prev,
                          {
                            id: `a-${Date.now()}-ig-error`,
                            role: 'assistant',
                            type: 'text',
                            content: `Instagram OAuth error: ${reason}`,
                          },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (
                m.type === 'widget-instagram-configured' ||
                m.type === 'widget-instagram-connected'
              ) {
                return (
                  <AssistantMessage key={m.id} borderClass='border-fuchsia-200'>
                    <InstagramConnectedWidgetExt
                      igId={m.igId}
                      username={m.username || m.name}
                      expiresAt={m.expiresAt}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-facebook-auth') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-blue-200'>
                    <FacebookAuthWidgetExt
                      widgetId={m.id}
                      onConnected={async payload => {
                        try {
                          const access_token = payload?.access_token;
                          const expires_in = payload?.expires_in;
                          const profile = payload?.fb_user || {};
                          const permissions = payload?.granted_scopes || [];
                          const pageId =
                            payload?.pageId ?? payload?.data?.pageId ?? null;
                          const pageName =
                            payload?.pageName ??
                            payload?.data?.pageName ??
                            null;

                          const expiresAt = expires_in
                            ? new Date(
                              Date.now() + Number(expires_in) * 1000
                            ).toISOString()
                            : null;

                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) throw new Error('Sesión inválida');

                          const ok = await upsertFacebookToken({
                            userId,
                            token: access_token,
                            expiresAt,
                            fbUserId: profile?.id || null,
                            grantedScopes: permissions,
                            fbName: profile?.name || null,
                            pageId: pageId,
                            pageName: pageName,
                          });

                          if (!ok)
                            throw new Error(
                              'No fue posible guardar el token en el perfil'
                            );
                          const connected = {
                            id: `a-${Date.now()}-fb-ok`,
                            role: 'assistant',
                            type: 'widget-facebook-connected',
                            name: profile?.name || null,
                            fbId: profile?.id || null,
                            scopes: permissions,
                          };
                          setMessages(prev => [...prev, connected]);
                          if (userId) {
                            await saveMessageToDB({
                              userId,
                              role: 'assistant',
                              content: '',
                              attachments: null,
                              type: 'widget-facebook-connected',
                              meta: {
                                name: connected.name,
                                fbId: connected.fbId,
                                scopes: connected.scopes,
                              },
                            });
                          }
                        } catch (err) {
                          setMessages(prev => [
                            ...prev,
                            {
                              id: `a-${Date.now()}-fb-error`,
                              role: 'assistant',
                              type: 'text',
                              content: `Facebook OAuth error: ${err?.message || err}`,
                            },
                          ]);
                        }
                      }}
                      onError={reason => {
                        setMessages(prev => [
                          ...prev,
                          {
                            id: `a-${Date.now()}-fb-error`,
                            role: 'assistant',
                            type: 'text',
                            content: `Facebook OAuth error: ${reason}`,
                          },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-facebook-connected') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-blue-200'>
                    <FacebookConnectedWidgetExt
                      name={m.name}
                      fbId={m.fbId}
                      scopes={m.scopes}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-logout') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-gray-200'>
                    <LogoutWidgetExt
                      onLogout={async () => {
                        try {
                          await supabase.auth.signOut();
                          // clear session cache
                          clearSessionCache();
                          if (
                            typeof window !== 'undefined' &&
                            window.__session_cache_once
                          ) {
                            try {
                              delete window.__session_cache_once;
                            } catch { }
                          }
                          setIsLoggedIn(false);
                          // Mostrar inmediatamente el gate de autenticación y limpiar el chat SOLO en UI
                          authGateShownRef.current = true;
                          setMessages([
                            {
                              id: `a-${Date.now()}-auth-gate`,
                              role: 'assistant',
                              type: 'widget-auth-gate',
                            },
                          ]);
                        } catch (err) {
                          setMessages(prev => [
                            ...prev,
                            {
                              id: `a-${Date.now()}-logout-error`,
                              role: 'assistant',
                              type: 'text',
                              content: `Error al cerrar sesión: ${err?.message || err}`,
                            },
                          ]);
                        }
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-clear-chat') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-red-200'>
                    <ClearChatWidgetExt
                      onClear={async () => {
                        const { data: sessionData } = await getSessionOnce();
                        const userId = sessionData?.session?.user?.id;
                        if (!userId) return;
                        try {
                          const res = await fetch('/api/clear', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId }),
                          });
                          if (!res.ok) throw new Error('API clear fallo');
                        } catch (e) {
                          // Fallback: borrar directo con supabase del cliente autenticado
                          if (supabase) {
                            await supabase
                              .from('messages')
                              .delete()
                              .eq('user_id', userId);
                          }
                        }
                        setMessages([]);
                        await loadHistoryAndNormalize();
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-calendar') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-blue-200'>
                    <div className='text-sm leading-relaxed'>
                      <div className='flex items-center gap-2 mb-2'>
                        <div className='h-1 w-6 rounded-full bg-gradient-to-r from-blue-400 to-blue-300' />
                        <p className='text-sm font-medium text-blue-700'>
                          Calendario
                        </p>
                      </div>
                      <p className='text-sm text-gray-600 mb-3'>
                        Haz clic en el icono de calendario 📅 en el composer
                        para programar una publicación.
                      </p>
                      <div className='bg-blue-50 p-3 rounded-lg'>
                        <p className='text-xs text-blue-800'>
                          💡 También puedes usar el calendario desde el botón
                          que está al lado del icono de adjuntar archivos.
                        </p>
                      </div>
                    </div>
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-ai-provider-config') {
                return (
                  <AssistantMessage key={m.id}>
                    <AIProviderConfigWidget
                      onConfigUpdate={(config) => {
                        console.log('AI config updated:', config);
                        // Opcional: mostrar mensaje de éxito
                      }}
                      onClose={() => {
                        // Opcional: ocultar widget después de configurar
                      }}
                      showError={m.showError || false}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-post-publish') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-indigo-200'>
                    <PostPublishWidgetExt
                      onContinue={async selected => {
                        try {
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) return;

                          // Verificar configuración de las plataformas seleccionadas
                          const configErrors = await checkPlatformConfiguration(userId, selected);
                          if (configErrors.length > 0) {
                            const errorMessage = createConfigurationErrorMessage(configErrors);
                            if (errorMessage) {
                              setMessages(prev => [...prev, errorMessage]);
                              await saveMessageToDB({
                                userId,
                                role: 'assistant',
                                content: errorMessage.content,
                                attachments: null,
                                type: 'text',
                              });
                            }
                            return; // No continuar si hay errores de configuración
                          }

                          // Guardar en estado y pasar a pedir medios
                          setPublishTargets(selected || []);
                          setPublishStage('await-media');
                          setCustomCaptionMode(false);
                          // Insertar instrucción clara del paso 2 y el widget de espera
                          setMessages(prev => [
                            ...prev,
                            {
                              id: `a-${Date.now()}-await-media`,
                              role: 'assistant',
                              type: 'widget-await-media',
                              meta: { targets: selected || [] },
                            },
                          ]);
                          // Persistir mensaje del widget
                          await saveMessageToDB({
                            userId,
                            role: 'assistant',
                            content: '',
                            attachments: null,
                            type: 'widget-await-media',
                            meta: { targets: selected || [] },
                          });
                          // Persistencia redundante de redes seleccionadas (por si no existe la columna meta)
                          const key = m.widgetKey || m.id;
                          await saveMessageToDB({
                            userId,
                            role: 'assistant',
                            content: JSON.stringify({
                              targets: selected || [],
                              widgetKey: key,
                              widgetId: m.id,
                            }),
                            attachments: null,
                            type: 'internal-targets',
                          });
                        } catch (e) {
                          setMessages(prev => [
                            ...prev,
                            {
                              id: `a-${Date.now()}-err`,
                              role: 'assistant',
                              type: 'text',
                              content:
                                'No pude continuar con el flujo de publicación.',
                            },
                          ]);
                        }
                      }}
                      defaultSelected={
                        widgetTargetDrafts[m.widgetKey || m.id] || []
                      }
                      onChangeTargets={async arr => {
                        try {
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) return;
                          const key = m.widgetKey || m.id;
                          setWidgetTargetDrafts(prev => ({
                            ...prev,
                            [key]: arr,
                          }));
                          await saveMessageToDB({
                            userId,
                            role: 'assistant',
                            content: JSON.stringify({
                              widgetKey: key,
                              widgetId: m.id,
                              targets: arr,
                              draft: true,
                            }),
                            attachments: null,
                            type: 'internal-targets',
                          });
                        } catch (_) { }
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-await-media') {
                const sel = Array.isArray(m?.meta?.targets)
                  ? m.meta.targets
                  : [];
                const hasVideoOnlyPlatforms = sel.some(
                  p => p === 'youtube' || p === 'tiktok'
                );
                const hasImagePlatforms = sel.some(
                  p => p === 'instagram' || p === 'facebook'
                );
                const onlyVideosPlatforms = sel.every(
                  p => p === 'youtube' || p === 'tiktok'
                );

                return (
                  <AssistantMessage key={m.id} borderClass='border-indigo-100'>
                    <div className='text-sm leading-relaxed'>
                      {onlyVideosPlatforms ? (
                        <div className='mb-1'>
                          Para continuar, adjunta un <strong>video</strong>{' '}
                          usando el botón de adjuntos debajo del cuadro de
                          texto. Formatos aceptados:{' '}
                          <strong>MP4, MOV, WEBM</strong>.
                        </div>
                      ) : hasVideoOnlyPlatforms ? (
                        <div className='mb-1'>
                          Para continuar, adjunta un <strong>video</strong>{' '}
                          usando el botón de adjuntos debajo del cuadro de texto
                          (requerido por YouTube/TikTok). Formatos aceptados:{' '}
                          <strong>MP4, MOV, WEBM</strong>.
                        </div>
                      ) : (
                        <div className='mb-1'>
                          Para continuar, adjunta al menos una imagen o video
                          usando el botón de adjuntos debajo del cuadro de
                          texto. Formatos aceptados: JPG, PNG, MP4, MOV, WEBM.
                        </div>
                      )}

                      {hasVideoOnlyPlatforms && !onlyVideosPlatforms && (
                        <div className='mb-2 text-xs p-2 rounded border border-amber-200'>
                          ⚠️ <strong>Nota:</strong> Incluiste{' '}
                          {sel
                            .filter(p => p === 'youtube' || p === 'tiktok')
                            .map(p => (p === 'youtube' ? 'YouTube' : 'TikTok'))
                            .join(' y ')}{' '}
                          que solo acepta videos. Debes subir un video para
                          publicar en todas las plataformas.
                        </div>
                      )}

                      {sel && sel.length > 0 && (
                        <div className='text-[11px] text-gray-500'>
                          Seleccionaste: {sel.join(', ')}
                        </div>
                      )}
                    </div>
                  </AssistantMessage>
                );
              }
              // NUEVO: Render del widget de sugerencia de descripción
              if (m.type === 'widget-caption-suggest') {
                const meta = m.meta || {};
                const caption = meta.caption || '';
                const base = meta.base || '';
                const targets = Array.isArray(meta.targets) ? meta.targets : [];
                return (
                  <AssistantMessage key={m.id} borderClass='border-emerald-200'>
                    <CaptionSuggestWidgetExt
                      caption={caption}
                      onAccept={async finalCaption => {
                        try {
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          const t =
                            targets && targets.length
                              ? targets.join(', ')
                              : '—';
                          const summary = `Perfecto. Redes: ${t}. Descripción final:\n${finalCaption || caption || base || '—'}`;
                          const schedulePreface = {
                            id: newId('schedule-preface'),
                            role: 'assistant',
                            type: 'text',
                            content:
                              'Paso final: agenda la subida del post. Indica la fecha y hora.',
                          };
                          const scheduleWidget = {
                            id: newId('schedule-widget'),
                            role: 'assistant',
                            type: 'widget-schedule',
                            meta: { defaultValue: null },
                          };
                          setMessages(prev => [
                            ...prev,
                            {
                              id: newId('caption-final'),
                              role: 'assistant',
                              type: 'text',
                              content: summary,
                            },
                            schedulePreface,
                            scheduleWidget,
                          ]);
                          if (userId) {
                            await saveMessageToDB({
                              userId,
                              role: 'assistant',
                              content: summary,
                              attachments: null,
                              type: 'text',
                            });
                            await saveMessageToDB({
                              userId,
                              role: 'assistant',
                              content: schedulePreface.content,
                              attachments: null,
                              type: 'text',
                            });
                            await saveMessageToDB({
                              userId,
                              role: 'assistant',
                              content: '',
                              attachments: null,
                              type: 'widget-schedule',
                              meta: { defaultValue: null },
                            });
                          }
                          setPublishStage('idle');
                          setCustomCaptionMode(false);
                        } catch (_) { }
                      }}
                      onRegenerate={async () => {
                        try {
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          const t =
                            targets && targets.length
                              ? targets.join(', ')
                              : 'generales';
                          const prompt = `Genera una descripción profesional y atractiva en español para redes sociales, con base en este texto del usuario. Requisitos: 2-4 líneas, tono natural y claro, 2-5 hashtags relevantes (sin exceso), 0-2 emojis discretos, incluir un CTA sutil si aplica. Devuelve solo el texto final del caption. Contexto de plataformas: ${t}. Texto base: ${base || caption || ''}`;
                          const res = await fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              mode: 'caption',
                              prompt: `${base || caption || ''}\nPlataformas destino: ${t}`,
                              userId: userId,
                            }),
                          });
                          const data = await res.json();
                          const suggestion =
                            (data?.text || '').trim() || caption || base || '';
                          const pre = {
                            id: newId('caption-preface-2'),
                            role: 'assistant',
                            type: 'text',
                            content: 'Otra propuesta:',
                          };
                          const capMeta = {
                            caption: suggestion,
                            base: base || caption || '',
                            targets,
                          };
                          const capWidget = {
                            id: newId('caption-suggest-2'),
                            role: 'assistant',
                            type: 'widget-caption-suggest',
                            meta: capMeta,
                          };
                          setMessages(prev => [...prev, pre, capWidget]);
                          if (userId) {
                            await saveMessageToDB({
                              userId,
                              role: 'assistant',
                              content: pre.content,
                              attachments: null,
                              type: 'text',
                            });
                            await saveMessageToDB({
                              userId,
                              role: 'assistant',
                              content: '',
                              attachments: null,
                              type: 'widget-caption-suggest',
                              meta: capMeta,
                            });
                          }
                        } catch (_) { }
                      }}
                      onCustom={() => {
                        setCustomCaptionMode(true);
                        setMessages(prev => [
                          ...prev,
                          {
                            id: newId('caption-custom'),
                            role: 'assistant',
                            type: 'text',
                            content:
                              'Perfecto, escribe la descripción que prefieras y la usaré como final.',
                          },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-schedule') {
                const def = m?.meta?.defaultValue || null;

                // Recopilar datos de publicación del flujo actual
                const publishData = (() => {
                  const userMediaMessages = messages.filter(
                    msg =>
                      msg.role === 'user' &&
                      msg.type === 'text+media' &&
                      Array.isArray(msg.attachments) &&
                      msg.attachments.length > 0
                  );

                  if (userMediaMessages.length === 0) {
                    return null;
                  }

                  const lastMediaMessage =
                    userMediaMessages[userMediaMessages.length - 1];
                  const attachments = lastMediaMessage.attachments || [];

                  let caption = '';
                  const captionMessages = messages.filter(
                    msg =>
                      msg.role === 'assistant' &&
                      msg.type === 'text' &&
                      msg.content &&
                      (msg.content.includes('Descripción final:') ||
                        msg.content.includes('Redes:'))
                  );

                  if (captionMessages.length > 0) {
                    const lastCaptionMsg =
                      captionMessages[captionMessages.length - 1];
                    const match = lastCaptionMsg.content.match(
                      /Descripción final:\s*(.+)$/s
                    );
                    if (match) {
                      caption = match[1].trim();
                    }
                  }

                  const imageUrl =
                    attachments.find(a => a.kind === 'image')?.url || null;
                  const videoUrl =
                    attachments.find(a => a.kind === 'video')?.url || null;

                  const platforms =
                    publishTargets && publishTargets.length > 0
                      ? publishTargets
                      : ['instagram'];

                  const result = {
                    caption,
                    imageUrl,
                    videoUrl,
                    platforms,
                  };

                  return result;
                })();

                return (
                  <AssistantMessage key={m.id} borderClass='border-violet-200'>
                    <ScheduleWidgetExt
                      defaultValue={def}
                      publishData={publishData}
                      onConfirm={async result => {
                        try {
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;

                          if (result.publishResult) {
                            const publishResult = result.publishResult;
                            const results = Array.isArray(
                              publishResult?.results
                            )
                              ? publishResult.results
                              : [];
                            const platformNames = {
                              instagram: 'Instagram',
                              facebook: 'Facebook',
                              youtube: 'YouTube',
                              tiktok: 'TikTok',
                            };
                            const successResults = results.filter(
                              r => r && r.success
                            );
                            const errorResults = results.filter(
                              r => r && !r.success
                            );

                            let confirmMessage = '';
                            if (results.length === 0) {
                              confirmMessage =
                                'No recibí resultados de publicación del servidor.';
                            } else if (errorResults.length === 0) {
                              const platformsStr = successResults
                                .map(
                                  r => platformNames[r.platform] || r.platform
                                )
                                .join(', ')
                                .replace(/,([^,]*)$/, ' y$1');
                              confirmMessage = `¡Perfecto! Tu contenido se publicó exitosamente en ${platformsStr}.`;
                              const links = successResults
                                .filter(r => r.url)
                                .map(
                                  r =>
                                    `${platformNames[r.platform] || r.platform}: ${r.url}`
                                );
                              if (links.length) {
                                confirmMessage += ` Puedes verlo aquí: ${links.join(' | ')}`;
                              }
                            } else if (successResults.length > 0) {
                              const okStr = successResults
                                .map(
                                  r => platformNames[r.platform] || r.platform
                                )
                                .join(', ')
                                .replace(/,([^,]*)$/, ' y$1');

                              const errStr = errorResults
                                .map(
                                  r =>
                                    `${platformNames[r.platform] || r.platform} (${r?.error || 'Error desconocido'})`
                                )
                                .join('; ');

                              const links = successResults
                                .filter(r => r.url)
                                .map(
                                  r =>
                                    `${platformNames[r.platform] || r.platform}: ${r.url}`
                                );
                              confirmMessage = `Se publicó parcialmente. Éxitos: ${okStr}.`;
                              if (links.length)
                                confirmMessage += ` Links: ${links.join(' | ')}.`;
                              confirmMessage += ` Errores: ${errStr}.`;
                            } else {
                              const errStr = errorResults
                                .map(
                                  r =>
                                    `${platformNames[r.platform] || r.platform} (${r?.error || 'Error desconocido'})`
                                )
                                .join('; ');
                              confirmMessage = `Hubo un problema al publicar: ${errStr || 'Error desconocido'}`;
                            }

                            const confirm = {
                              id: newId('publish-confirm'),
                              role: 'assistant',
                              type: 'text',
                              content: confirmMessage,
                            };

                            const nextPostMessage = {
                              id: newId('next-post-offer'),
                              role: 'assistant',
                              type: 'text',
                              content:
                                '¿Te gustaría subir otro post? Solo dime "sí" o "publicar" para empezar de nuevo.',
                            };

                            setMessages(prev => [
                              ...prev,
                              confirm,
                              nextPostMessage,
                            ]);

                            if (userId) {
                              await saveMessageToDB({
                                userId,
                                role: 'assistant',
                                content: '',
                                attachments: null,
                                type: 'internal-publish-result',
                                meta: {
                                  scheduledDate: result.scheduledDate,
                                  publishResult: publishResult,
                                  platforms: results.map(r => ({
                                    platform: r.platform,
                                    success: !!r.success,
                                    id: r.id || null,
                                    url: r.url || null,
                                    error: r.error || null,
                                  })),
                                },
                              });
                              await saveMessageToDB({
                                userId,
                                role: 'assistant',
                                content: confirm.content,
                                attachments: null,
                                type: 'text',
                              });
                              await saveMessageToDB({
                                userId,
                                role: 'assistant',
                                content: nextPostMessage.content,
                                attachments: null,
                                type: 'text',
                              });
                            }
                          } else {
                            // Solo programación (comportamiento anterior)
                            const dateValue = result.scheduledDate || result;
                            const when = new Date(dateValue);
                            const pretty = isNaN(when.getTime())
                              ? dateValue
                              : when.toLocaleString();
                            const confirm = {
                              id: newId('schedule-confirm'),
                              role: 'assistant',
                              type: 'text',
                              content: `Perfecto. Programé la subida para ${pretty}.`,
                            };

                            const nextPostMessage = {
                              id: newId('next-post-offer-schedule'),
                              role: 'assistant',
                              type: 'text',
                              content:
                                '¿Te gustaría subir otro post? Solo dime "sí" o "publicar" para empezar de nuevo.',
                            };

                            setMessages(prev => [
                              ...prev,
                              confirm,
                              nextPostMessage,
                            ]);

                            if (userId) {
                              await saveMessageToDB({
                                userId,
                                role: 'assistant',
                                content: '',
                                attachments: null,
                                type: 'internal-schedule',
                                meta: { value: result },
                              });
                              await saveMessageToDB({
                                userId,
                                role: 'assistant',
                                content: confirm.content,
                                attachments: null,
                                type: 'text',
                              });
                              await saveMessageToDB({
                                userId,
                                role: 'assistant',
                                content: nextPostMessage.content,
                                attachments: null,
                                type: 'text',
                              });
                            }
                          }

                          setPublishStage('idle');
                          setPublishTargets([]);
                          setCustomCaptionMode(false);
                        } catch (error) {
                          const errorMsg = {
                            id: newId('schedule-error'),
                            role: 'assistant',
                            type: 'text',
                            content: `Error: ${error.message}`,
                          };
                          setMessages(prev => [...prev, errorMsg]);
                        }
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-youtube-auth') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-red-200'>
                    <YouTubeAuthWidgetExt
                      widgetId={m.id}
                      onConnected={async payload => {
                        try {
                          const {
                            access_token,
                            refresh_token,
                            expires_in,
                            expires_at,
                            channelId,
                            channelTitle,
                            channel,
                            granted_scopes,
                            grantedScopes,
                          } = payload || {};
                          const expiresAt =
                            expires_at ||
                            (expires_in
                              ? new Date(
                                Date.now() + Number(expires_in) * 1000
                              ).toISOString()
                              : null);
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) throw new Error('Sesión inválida');
                          const chId = channelId || channel?.id || null;
                          const chTitle =
                            channelTitle || channel?.title || null;
                          const scopes = Array.isArray(granted_scopes)
                            ? granted_scopes
                            : Array.isArray(grantedScopes)
                              ? grantedScopes
                              : [];
                          const ok = await upsertYouTubeToken({
                            userId,
                            token: access_token,
                            refreshToken: refresh_token || null,
                            expiresAt,
                            channelId: chId,
                            channelTitle: chTitle,
                            grantedScopes: scopes,
                          });
                          if (!ok)
                            throw new Error(
                              'No fue posible guardar el token de YouTube'
                            );
                          const connected = {
                            id: `a-${Date.now()}-yt-ok`,
                            role: 'assistant',
                            type: 'widget-youtube-connected',
                            channelId: chId,
                            channelTitle: chTitle,
                            grantedScopes: scopes,
                            expiresAt,
                          };
                          setMessages(prev => [...prev, connected]);
                          await saveMessageToDB({
                            userId,
                            role: 'assistant',
                            content: '',
                            attachments: null,
                            type: 'widget-youtube-connected',
                            meta: {
                              channelId: connected.channelId,
                              channelTitle: connected.channelTitle,
                              grantedScopes: connected.grantedScopes,
                              expiresAt,
                            },
                          });
                        } catch (err) {
                          setMessages(prev => [
                            ...prev,
                            {
                              id: `a-${Date.now()}-yt-error`,
                              role: 'assistant',
                              type: 'text',
                              content: `YouTube OAuth error: ${err?.message || err}`,
                            },
                          ]);
                        }
                      }}
                      onError={reason => {
                        setMessages(prev => [
                          ...prev,
                          {
                            id: `a-${Date.now()}-yt-error`,
                            role: 'assistant',
                            type: 'text',
                            content: `YouTube OAuth error: ${reason}`,
                          },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-youtube-connected') {
                const meta = m.meta || {};
                return (
                  <AssistantMessage key={m.id} borderClass='border-red-200'>
                    <YouTubeConnectedWidgetExt
                      channelId={m.channelId ?? meta.channelId}
                      channelTitle={m.channelTitle ?? meta.channelTitle}
                      grantedScopes={m.grantedScopes ?? meta.grantedScopes}
                      expiresAt={m.expiresAt ?? meta.expiresAt}
                    />
                  </AssistantMessage>
                );
              }

              if (m.type === 'widget-tiktok-auth') {
                return (
                  <AssistantMessage key={m.id} borderClass='border-gray-300'>
                    <TikTokAuthWidgetExt
                      widgetId={m.id}
                      onConnected={async payload => {
                        try {
                          const access_token = payload?.access_token || null;
                          const refresh_token = payload?.refresh_token || null;
                          const expires_in = payload?.expires_in || null;
                          const open_id = payload?.open_id || null;
                          const granted_scopes = payload?.granted_scopes || [];
                          const expiresAt = expires_in
                            ? new Date(
                              Date.now() + Number(expires_in) * 1000
                            ).toISOString()
                            : null;
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) throw new Error('Sesión inválida');
                          const ok = await upsertTikTokToken({
                            userId,
                            token: access_token,
                            refreshToken: refresh_token,
                            expiresAt,
                            openId: open_id,
                            grantedScopes: granted_scopes,
                          });
                          if (!ok)
                            throw new Error(
                              'No fue posible guardar el token de TikTok'
                            );

                          const connected = {
                            id: newId('tt-ok'),
                            role: 'assistant',
                            type: 'widget-tiktok-connected',
                            openId: open_id || null,
                            grantedScopes: granted_scopes || [],
                            expiresAt,
                          };
                          setMessages(prev => [...prev, connected]);
                          await saveMessageToDB({
                            userId,
                            role: 'assistant',
                            content: '',
                            attachments: null,
                            type: 'widget-tiktok-connected',
                            meta: {
                              openId: connected.openId,
                              grantedScopes: connected.grantedScopes,
                              expiresAt,
                            },
                          });
                        } catch (err) {
                          setMessages(prev => [
                            ...prev,
                            {
                              id: newId('tt-error'),
                              role: 'assistant',
                              type: 'text',
                              content: `TikTok OAuth error: ${err?.message || err}`,
                            },
                          ]);
                        }
                      }}
                      onError={reason => {
                        setMessages(prev => [
                          ...prev,
                          {
                            id: newId('tt-error'),
                            role: 'assistant',
                            type: 'text',
                            content: `TikTok OAuth error: ${reason}`,
                          },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === 'widget-tiktok-connected') {
                const meta = m.meta || {};
                return (
                  <AssistantMessage key={m.id} borderClass='border-gray-300'>
                    <TikTokConnectedWidgetExt
                      openId={m.openId ?? meta.openId}
                      grantedScopes={m.grantedScopes ?? meta.grantedScopes}
                      expiresAt={m.expiresAt ?? meta.expiresAt}
                    />
                  </AssistantMessage>
                );
              }

              return (
                <AssistantMessage key={m.id} borderClass='border-gray-200'>
                  {/* Renderizar Markdown si el contenido tiene formato Markdown */}
                  <ReactMarkdown
                    components={{
                      a: props => (
                        <a
                          {...props}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 underline'
                        />
                      ),
                      code: props => (
                        <code
                          {...props}
                          className='bg-gray-100 px-1 rounded text-sm font-mono'
                        />
                      ),
                      pre: props => (
                        <pre
                          {...props}
                          className='bg-gray-100 p-2 rounded overflow-x-auto'
                        />
                      ),
                      ul: props => <ul {...props} className='list-disc ml-6' />,
                      ol: props => (
                        <ol {...props} className='list-decimal ml-6' />
                      ),
                      blockquote: props => (
                        <blockquote
                          {...props}
                          className='border-l-4 border-blue-200 pl-4 italic text-gray-500'
                        />
                      ),
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </AssistantMessage>
              );
            }
            return (
              <UserMessage
                key={m.id}
                attachments={m.attachments}
                onAttachmentClick={onAttachmentClick}
              >
                {m.text}
              </UserMessage>
            );
          })}

          {/* Indicador de escritura del asistente */}
          {loading && (
            <AssistantMessage borderClass='border-gray-200'>
              <div className='flex items-center gap-2'>
                <span className='sr-only'>El asistente está escribiendo…</span>
                <div className='flex items-end gap-1' aria-hidden='true'>
                  <span className='block h-2.5 w-2.5 rounded-full bg-gray-300 dot'></span>
                  <span className='block h-2.5 w-2.5 rounded-full bg-gray-300 dot'></span>
                  <span className='block h-2.5 w-2.5 rounded-full bg-gray-300 dot'></span>
                </div>
              </div>
              <style jsx>{`
                @keyframes typingBounce {
                  0%,
                  80%,
                  100% {
                    transform: translateY(0);
                    opacity: 0.6;
                  }
                  40% {
                    transform: translateY(-3px);
                    opacity: 1;
                  }
                }
                .dot {
                  animation: typingBounce 1s infinite ease-in-out;
                }
                .dot:nth-child(2) {
                  animation-delay: 0.15s;
                }
                .dot:nth-child(3) {
                  animation-delay: 0.3s;
                }
              `}</style>
            </AssistantMessage>
          )}

          {/* Ancla inferior para scroll suave */}
          <li ref={bottomRef} aria-hidden='true' />
        </ul>

        {/* El input (Composer) permanece debajo como antes */}
        <Composer onSend={handleSend} loading={loading || historyLoading} />
      </div>

      {/* Lightbox modal */}
      {lightbox && (
        <div
          className='fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4'
          role='dialog'
          aria-modal='true'
          onClick={closeLightbox}
        >
          <div
            className='relative max-w-5xl w-full'
            onClick={e => e.stopPropagation()}
          >
            <button
              type='button'
              onClick={closeLightbox}
              className='absolute -top-3 -right-3 bg-white text-gray-700 rounded-full size-8 flex items-center justify-center shadow ring-1 ring-black/10 cursor-pointer'
              aria-label='Cerrar'
            >
              ×
            </button>
            <div className='bg-black rounded-lg overflow-hidden flex items-center justify-center'>
              {lightbox.kind === 'video' ? (
                <video
                  src={lightbox.url}
                  controls
                  autoPlay
                  className='max-h-[80vh] w-auto'
                />
              ) : (
                <img
                  src={lightbox.url}
                  alt={lightbox.name || 'media'}
                  className='max-h-[80vh] w-auto'
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
