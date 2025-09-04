"use client";

import { useEffect, useRef, useState } from "react";
import IntroHeader from "@/components/IntroHeader";
import AssistantMessage from "@/components/AssistantMessage";
import UserMessage from "@/components/UserMessage";
import Composer from "@/components/Composer";
import { supabase } from "@/lib/supabaseClient";
import { AuthGateWidget as AuthGateWidgetExt, AuthFormWidget as AuthFormWidgetExt } from "@/components/widgets/AuthWidgets";
import { InstagramCredentialsWidget as InstagramCredentialsWidgetExt, InstagramConfiguredWidget as InstagramConfiguredWidgetExt } from "@/components/widgets/InstagramWidgets";
import { FacebookAuthWidget as FacebookAuthWidgetExt, FacebookConnectedWidget as FacebookConnectedWidgetExt } from "@/components/widgets/FacebookWidgets";
import { YouTubeAuthWidget as YouTubeAuthWidgetExt, YouTubeConnectedWidget as YouTubeConnectedWidgetExt } from "@/components/widgets/YouTubeWidgets";
import { TikTokAuthWidget as TikTokAuthWidgetExt, TikTokConnectedWidget as TikTokConnectedWidgetExt } from "@/components/widgets/TikTokWidgets";
import { LogoutWidget as LogoutWidgetExt, ClearChatWidget as ClearChatWidgetExt, PlatformsWidget as PlatformsWidgetExt, PostPublishWidget as PostPublishWidgetExt } from "@/components/widgets/ControlWidgets";
import { CaptionSuggestWidget as CaptionSuggestWidgetExt } from "@/components/widgets/ControlWidgets";
import { upsertInstagramCreds, upsertFacebookToken, upsertYouTubeToken, upsertTikTokToken } from "@/lib/apiHelpers";
import { saveMessageToDB, loadHistoryForCurrentUser } from "@/lib/databaseUtils";

// Session cache (module-scope) to avoid duplicate supabase.auth.getSession() calls
let __sessionCache = null;
let __sessionInflight = null;
async function getSessionOnce() {
  if (__sessionCache) return { data: __sessionCache };
  if (__sessionInflight) return await __sessionInflight;
  __sessionInflight = (async () => {
    const res = await supabase.auth.getSession();
    __sessionCache = res?.data || null;
    __sessionInflight = null;
    return { data: __sessionCache };
  })();
  return await __sessionInflight;
}
// import { detectInstagramIntent, detectUpdateCredentialsIntent, detectFacebookIntent, detectYouTubeIntent, showPlatformsWidgetHeuristic, showPlatformsWidgetByTool } from "@/lib/intentDetection";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const authGateShownRef = useRef(false);
  const bottomRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);
  // Estado del flujo de publicación lineal
  const [publishStage, setPublishStage] = useState('idle'); // 'idle' | 'await-media' | 'await-description'
  const [publishTargets, setPublishTargets] = useState([]);
  const [widgetTargetDrafts, setWidgetTargetDrafts] = useState({});
  const [customCaptionMode, setCustomCaptionMode] = useState(false);

  // Helper to generate robust unique IDs for messages to avoid duplicate React keys
  const newId = (suffix = "msg") => {
    try {
      if (typeof crypto !== "undefined" && crypto?.randomUUID) {
        return `a-${suffix}-${crypto.randomUUID()}`;
      }
    } catch {}
    return `a-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  };

  // Subir archivo a Cloudinary vía API interna
  const uploadToCloudinary = async (file, { folder = 'ui-chat-uploads' } = {}) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', folder);
      fd.append('resourceType', 'auto');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      return { secureUrl: data.secureUrl, publicId: data.publicId, resourceType: data.resourceType };
    } catch (e) {
      console.warn('Cloudinary upload error:', e?.message || e);
      return null;
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
      const draftsByWidget = {};

      const normalized = (rows || []).map((r) => {
        const rType = r.type || (r.role === "user" ? (Array.isArray(r.attachments) && r.attachments.length ? "text+media" : "text") : "text");

        // Render según type almacenado
        if (r.role === "assistant") {
          if (rType === "widget-platforms") {
            return { id: r.id, role: "assistant", type: "widget-platforms" };
          }
          if (rType === "widget-post-publish") {
            return { id: r.id, role: "assistant", type: "widget-post-publish", widgetKey: r?.meta?.widgetKey };
          }
          if (rType === "widget-await-media") {
            const targets = Array.isArray(r?.meta?.targets) ? r.meta.targets : null;
            if (targets) {
              // Guardar SIEMPRE la última selección para restaurar tras recarga (flujo global)
              restoreTargets = targets;
            }
            sawAwaitMedia = true;
            return { id: r.id, role: "assistant", type: "widget-await-media", meta: targets ? { targets } : undefined };
          }
          if (rType === "internal-targets") {
            // Mensaje interno para restaurar targets; ahora también soporta drafts por widget
            try {
              let parsed = null;
              if (typeof r.content === 'string' && r.content.trim()) {
                parsed = JSON.parse(r.content);
              } else if (r?.meta?.targets) {
                parsed = { targets: r.meta.targets };
              }
              const t = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.targets) ? parsed.targets : null);
              const key = parsed?.widgetKey || parsed?.widgetId || r?.meta?.widgetKey || r?.meta?.widgetId || null;
              if (key && t) {
                draftsByWidget[key] = t;
              }
              if (t) restoreTargets = t; // Mantener la última selección
            } catch (_) {}
            return null; // No renderizar en UI
          }
          if (rType === "widget-auth-gate") {
            return { id: r.id, role: "assistant", type: "widget-auth-gate" };
          }
          if (rType === "widget-auth-form") {
            return { id: r.id, role: "assistant", type: "widget-auth-form" };
          }
          if (rType === "widget-instagram-credentials") {
            return { id: r.id, role: "assistant", type: "widget-instagram-credentials" };
          }
          if (rType === "widget-instagram-configured") {
            const name = r?.meta?.name || null;
            const id = r?.meta?.id || null;
            return { id: r.id, role: "assistant", type: "widget-instagram-configured", name, igId: id };
          }
          if (rType === "widget-facebook-auth") {
            return { id: r.id, role: "assistant", type: "widget-facebook-auth" };
          }
          if (rType === "widget-facebook-connected") {
            const fbId = r?.meta?.fbId || null;
            const name = r?.meta?.name || null;
            const scopes = r?.meta?.scopes || null;
            return { id: r.id, role: "assistant", type: "widget-facebook-connected", fbId, name, scopes };
          }
          if (rType === "widget-youtube-auth") {
            return { id: r.id, role: "assistant", type: "widget-youtube-auth" };
          }
          if (rType === "widget-youtube-connected") {
            const channelId = r?.meta?.channelId || null;
            const channelTitle = r?.meta?.channelTitle || null;
            const grantedScopes = r?.meta?.grantedScopes || null;
            const expiresAt = r?.meta?.expiresAt || null;
            return { id: r.id, role: "assistant", type: "widget-youtube-connected", meta: { channelId, channelTitle, grantedScopes, expiresAt } };
          }
          if (rType === "widget-tiktok-auth") {
            return { id: r.id, role: "assistant", type: "widget-tiktok-auth" };
          }
          if (rType === "widget-tiktok-connected") {
            const openId = r?.meta?.openId || null;
            const grantedScopes = r?.meta?.grantedScopes || null;
            const expiresAt = r?.meta?.expiresAt || null;
            return { id: r.id, role: "assistant", type: "widget-tiktok-connected", meta: { openId, grantedScopes, expiresAt } };
          }
          if (rType === "widget-logout") {
            return { id: r.id, role: "assistant", type: "widget-logout" };
          }
          if (rType === "widget-clear-chat") {
            return { id: r.id, role: "assistant", type: "widget-clear-chat" };
          }
          if (rType === "widget-caption-suggest") {
            const caption = r?.meta?.caption || '';
            const base = r?.meta?.base || '';
            const targets = Array.isArray(r?.meta?.targets) ? r.meta.targets : [];
            return { id: r.id, role: "assistant", type: "widget-caption-suggest", meta: { caption, base, targets } };
          }

          return { id: r.id, role: "assistant", type: "text", content: r.content };
        }

        // Usuario
        if (rType === "text+media") {
          const att = Array.isArray(r.attachments) ? r.attachments : [];
          const mapped = att
            .map((a) => {
              const isVideo = a.kind === 'video';
              const url = a.url || a.secureUrl || null;
              if (!url) return null;
              return { kind: isVideo ? 'video' : 'image', url, name: a.name || undefined };
            })
            .filter(Boolean);
          return { id: r.id, role: "user", type: "text", text: (r.content || ""), attachments: mapped };
        }
        return { id: r.id, role: "user", type: "text", text: (r.content || ""), attachments: [] };
      }).filter(Boolean);

      // Analizar stage por contenido de mensajes
      let lastAskDescIndex = -1;
      for (let i = 0; i < normalized.length; i++) {
        const m = normalized[i];
        if (m.role === 'assistant' && m.type === 'text' && typeof m.content === 'string' && m.content.startsWith('Paso 3:')) {
          lastAskDescIndex = i;
        }
      }
      let finalSummaryAfter = false;
      if (lastAskDescIndex >= 0) {
        for (let j = lastAskDescIndex + 1; j < normalized.length; j++) {
          const m = normalized[j];
          if (m.role === 'assistant' && m.type === 'text' && /El flujo termina aquí por ahora\./i.test(m.content || '')) {
            finalSummaryAfter = true;
            break;
          }
        }
      }

      // Desduplicar widgets únicos conservando el último
      const uniqueTypes = new Set(["widget-post-publish", "widget-await-media"]);
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
          if (m.role === 'assistant' && m.type === 'widget-post-publish') return m;
        }
        return null;
      })();
      if (lastPostPublish && restoreTargets && !(draftsByWidget[lastPostPublish.widgetKey || lastPostPublish.id])) {
        draftsByWidget[lastPostPublish.widgetKey || lastPostPublish.id] = restoreTargets;
      }

      // Restaurar estado del flujo
      if (lastAskDescIndex >= 0 && !finalSummaryAfter) {
        setPublishStage('await-description');
      } else if (sawAwaitMedia && lastAskDescIndex < 0) {
        setPublishStage('await-media');
      } else {
        setPublishStage('idle');
      }
      if (restoreTargets && Array.isArray(restoreTargets)) {
        setPublishTargets(restoreTargets);
      }
      setWidgetTargetDrafts(draftsByWidget);
      setIsLoggedIn(true);
    } catch (e) {
      console.warn("No se pudo cargar el historial:", e?.message || e);
    } finally {
      setHistoryLoading(false);
    }
  };
  const handleSend = async ({ text, files }) => {

    if (!supabase) {
      if (!isLoggedIn && !authGateShownRef.current) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}-auth-gate`, role: "assistant", type: "widget-auth-gate" },
        ]);
        authGateShownRef.current = true;
      }
      return;
    }

    const { data: sessionData } = await getSessionOnce();
    const hasSession = Boolean(sessionData?.session);
    if (!hasSession) {
      if (!authGateShownRef.current) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}-auth-gate`, role: "assistant", type: "widget-auth-gate" },
        ]);
        authGateShownRef.current = true;
      }
      return;
    }
    const userId = sessionData?.session?.user?.id;

    // Subir adjuntos a Cloudinary antes de construir el mensaje
    let uploadedAttachments = [];
    if (Array.isArray(files) && files.length > 0) {
      setLoading(true);
      const uploads = [];
      for (const f of files) {
        uploads.push(
          (async () => {
            const isVideo = f.type?.startsWith('video/') || /(\.(mp4|mov|webm|ogg|mkv|m4v))$/i.test(f.name || "");
            const kind = isVideo ? 'video' : 'image';
            const res = await uploadToCloudinary(f);
            if (res?.secureUrl) {
              return { kind, url: res.secureUrl, publicId: res.publicId, name: f.name };
            } else {
              // Fallback: no URL si falló
              return null;
            }
          })()
        );
      }
      const results = await Promise.all(uploads);
      uploadedAttachments = results.filter(Boolean);
      setLoading(false);
    }

    // 1) Agregar el mensaje del usuario a la UI y guardar en DB
    const trimmed = (text || "").trim();
    const userMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      type: uploadedAttachments.length ? "text+media" : "text",
      text: text || "",
      attachments: uploadedAttachments,
    };
    setMessages((prev) => [...prev, userMessage]);

    const attachmentsForDB = uploadedAttachments.map(({ kind, url, publicId, name }) => ({ kind, url, publicId, name }));
    await saveMessageToDB({ userId, role: "user", content: trimmed, attachments: attachmentsForDB, type: uploadedAttachments.length ? "text+media" : "text" });

    // Detectar si el usuario quiere iniciar un nuevo flujo de publicación explícitamente
    const wantsNewPublish = /\b(publicar|postear|subir|programar)\b/i.test(trimmed) && /(post|publicaci\u00F3n|video|reel|contenido)/i.test(trimmed);
    if (wantsNewPublish && publishStage !== 'idle') {
      // Reiniciar el gating para permitir que aparezca el selector nuevamente
      setPublishStage('idle');
    }

    // NUEVO: intención de cancelar el flujo de publicación actual
    const lower = trimmed.toLowerCase();
    const cancelPhrases = [
      'cancelar', 'cancela', 'cancel',
      'olvídalo', 'olvidalo', 'olvidalo',
      'ya no', 'no quiero', 'mejor no',
      'detente', 'detener', 'parar',
      'abort', 'aborta', 'anular',
      'no continuar', 'no sigas', 'stop'
    ];
    const wantsCancelPublish = cancelPhrases.some((p) => lower.includes(p));
    if (publishStage !== 'idle' && wantsCancelPublish) {
      // Romper el flujo de publicación solo si el usuario expresa cancelación
      const confirm = { id: newId('cancel-publish'), role: 'assistant', type: 'text', content: 'Entendido, cancelé el flujo de publicación. Cuando quieras, podemos volver a empezar.' };
      setPublishStage('idle');
      setPublishTargets([]);
      setCustomCaptionMode(false);
      setMessages((prev) => [...prev, confirm]);
      await saveMessageToDB({ userId, role: 'assistant', content: confirm.content, attachments: null, type: 'text' });
      return;
    }

    // Flujo de publicación lineal: aplicar gating según etapa (solo si no se solicitó reiniciar)
    if (!wantsNewPublish && publishStage === 'await-media') {
      if (uploadedAttachments.length === 0) {
        setMessages((prev) => [
          ...prev,
          { id: newId('need-media'), role: 'assistant', type: 'text', content: 'Necesito que adjuntes al menos una imagen o video para continuar.' },
        ]);
        return;
      } else {
        setPublishStage('await-description');
        setCustomCaptionMode(false);
        const step3 = { id: newId('ask-description'), role: 'assistant', type: 'text', content: 'Paso 3: Ahora escribe la descripción para el post.' };
        setMessages((prev) => [
          ...prev,
          step3,
        ]);
        await saveMessageToDB({ userId, role: 'assistant', content: step3.content, attachments: null, type: 'text' });
        return;
      }
    }

    if (!wantsNewPublish && publishStage === 'await-description') {
      if (!trimmed) {
        setMessages((prev) => [
          ...prev,
          { id: newId('need-description'), role: 'assistant', type: 'text', content: 'Por favor escribe la descripción del post para continuar.' },
        ]);
        return;
      } else {
        // Si el usuario eligió "Escribir la mía", tomar su siguiente mensaje como final
        if (customCaptionMode) {
          const targets = (publishTargets || []).join(', ');
          const finalMsg = `Perfecto. Redes: ${targets || '—'}. Descripción final:\n${trimmed}`;
          setMessages((prev) => [
            ...prev,
            { id: newId('caption-final-user'), role: 'assistant', type: 'text', content: finalMsg },
          ]);
          await saveMessageToDB({ userId, role: 'assistant', content: finalMsg, attachments: null, type: 'text' });
          setPublishStage('idle');
          setPublishTargets([]);
          setCustomCaptionMode(false);
          return;
        }
        // Generar una descripción profesional en base al texto del usuario
        const targetsArr = publishTargets || [];
        const targets = targetsArr.join(', ');
        const prompt = `Genera una descripción profesional y atractiva en español para redes sociales, con base en este texto del usuario. Requisitos: 2-4 líneas, tono natural y claro, 2-5 hashtags relevantes (sin exceso), 0-2 emojis discretos, incluir un CTA sutil si aplica. Devuelve solo el texto final (sin comillas ni explicaciones).\n\nTexto base:\n${trimmed}\n\nPlataformas destino: ${targets || 'generales'}`;
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
          });
          const data = await res.json();
          const suggestion = (data?.text || '').trim();
          const preface = { id: newId('caption-preface'), role: 'assistant', type: 'text', content: `Perfecto. Redes: ${targets || '—'}. Te propongo esta descripción:` };
          const capMeta = { caption: suggestion || trimmed, base: trimmed, targets: targetsArr };
          const capWidget = { id: newId('caption-suggest'), role: 'assistant', type: 'widget-caption-suggest', meta: capMeta };
          setMessages((prev) => [...prev, preface, capWidget]);
          await saveMessageToDB({ userId, role: 'assistant', content: preface.content, attachments: null, type: 'text' });
          await saveMessageToDB({ userId, role: 'assistant', content: '', attachments: null, type: 'widget-caption-suggest', meta: capMeta });
          // Nos mantenemos en await-description para permitir "regenerar" o "escribir la mía".
          return;
        } catch (e) {
          const fallback = `Perfecto. Redes: ${targets || '—'}. Usa esta descripción o edítala: ${trimmed}`;
          setMessages((prev) => [...prev, { id: newId('caption-fallback'), role: 'assistant', type: 'text', content: fallback }]);
          await saveMessageToDB({ userId, role: 'assistant', content: fallback, attachments: null, type: 'text' });
          setPublishStage('idle');
          setPublishTargets([]);
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
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: trimmed }] }),
        });
        const data = await res.json();
        const assistantText = data?.text || "";

        const additions = [];
        if (assistantText) {
          additions.push({ id: `a-${Date.now()}-t`, role: "assistant", type: "text", content: assistantText });
        }

        const widgets = Array.isArray(data?.widgets)
          ? data.widgets
          : (data?.widget ? [data.widget] : []);

        const widgetTypeMap = {
          platforms: "widget-platforms",
          "post-publish": "widget-post-publish",
          "caption-suggest": "widget-caption-suggest",
          "instagram-credentials": "widget-instagram-credentials",
          "facebook-auth": "widget-facebook-auth",
          "youtube-auth": "widget-youtube-auth",
          "tiktok-auth": "widget-tiktok-auth",
          logout: "widget-logout",
          "clear-chat": "widget-clear-chat",
        };

        const widgetAdditionsMeta = [];
        for (const w of widgets) {
          const t = widgetTypeMap[w];
          if (t) {
            const widgetKey = newId('wkey');
            additions.push({ id: newId(`w-${w}`), role: "assistant", type: t, widgetKey });
            widgetAdditionsMeta.push({ type: t, widgetKey });
          }
        }

        setMessages((prev) => [...prev, ...additions]);

        // Guardar respuesta del asistente y widgets en DB
        if (assistantText) {
          await saveMessageToDB({ userId, role: "assistant", content: assistantText, attachments: null, type: "text" });
        }
        for (const wm of widgetAdditionsMeta) {
          await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: wm.type, meta: { widgetKey: wm.widgetKey } });
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", type: "text", content: "Hubo un error obteniendo la respuesta." },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) {
        setIsLoggedIn(false);
        if (!authGateShownRef.current) {
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}-auth-gate`, role: "assistant", type: "widget-auth-gate" },
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
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}-auth-gate`, role: "assistant", type: "widget-auth-gate" },
          ]);
          authGateShownRef.current = true;
        }
      }
    };
    checkSession();
  }, []);

  const onAttachmentClick = (a) => setLightbox(a);
  const closeLightbox = () => setLightbox(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-pink-50 px-4 sm:px-6 lg:px-8 text-gray-600">
      <div className="max-w-4xl mx-auto">
        <IntroHeader />

        <ul className="mt-16 space-y-5">
          {historyLoading && (
            <li className="flex justify-center" aria-live="polite">
              <div className="inline-flex items-center gap-3 rounded-full px-4 py-2 bg-white/80 backdrop-blur border border-blue-100 shadow-sm">
                <span className="relative inline-flex">
                  <span className="size-5 rounded-full border-2 border-blue-300 border-t-transparent animate-spin"></span>
                </span>
                <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">Cargando tus mensajes…</span>
              </div>
            </li>
          )}
          {messages.map((m) => {
            if (m.role === "assistant") {
              if (m.type === "widget-platforms") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <PlatformsWidgetExt />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-auth-gate") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <AuthGateWidgetExt onOpen={(mode) => {
                      setMessages((prev) => [
                        ...prev,
                        { id: `a-${Date.now()}-auth-${mode}`, role: "assistant", type: "widget-auth-form", mode },
                      ]);
                    }} />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-auth-form") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <AuthFormWidgetExt
                      mode={m.mode}
                      onLogin={async ({ mode, name, email, pass }) => {
                        if (supabase) {
                          try {
                            if (mode === "signup") {
                              const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name } } });
                              if (error) throw error;
                            } else {
                              const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
                              if (error) throw error;
                            }
                            await loadHistoryAndNormalize();
                            setMessages((prev) => [
                              ...prev,
                              { id: `a-${Date.now()}-auth-ok`, role: "assistant", type: "text", content: "Ingreso exitoso 🥳." },
                            ]);
                            return;
                          } catch (err) {
                            throw err;
                          }
                        }
                        setMessages((prev) => [
                          ...prev,
                          {
                            id: `a-${Date.now()}-auth-submitted`,
                            role: "assistant",
                            type: "text",
                            content: `Formulario de ${mode === "login" ? "inicio de sesión" : "creación de cuenta"} recibido (demo).`,
                          },
                        ]);
                      }}
                      onError={(err) => {
                        setMessages((prev) => [
                          ...prev,
                          { id: `a-${Date.now()}-auth-error`, role: "assistant", type: "text", content: `Error de autenticación: ${err?.message || err}` },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-instagram-credentials") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-fuchsia-200">
                    <InstagramCredentialsWidgetExt
                      widgetId={m.id}
                      onSubmit={async ({ username, password }) => {
                        const { data: sessionData } = await getSessionOnce();
                        const userId = sessionData?.session?.user?.id;
                        if (!userId) {
                          setMessages((prev) => [
                            ...prev,
                            { id: `a-${Date.now()}-ig-error`, role: "assistant", type: "text", content: `Error guardando credenciales de Instagram: Sesión inválida` },
                          ]);
                          return;
                        }
                        try {
                          const ok = await upsertInstagramCreds({ userId, username, password });
                          if (!ok) throw new Error("No fue posible guardar credenciales");
                          const configured = { id: `a-${Date.now()}-ig-ok`, role: "assistant", type: "widget-instagram-configured", username };
                          setMessages((prev) => [...prev, configured]);
                          const { data: sessionData2 } = await getSessionOnce();
                          const userId2 = sessionData2?.session?.user?.id;
                          if (userId2) {
                            await saveMessageToDB({ userId: userId2, role: "assistant", content: "", attachments: null, type: "widget-instagram-configured", meta: { username } });
                          }
                        } catch (err) {
                          setMessages((prev) => [
                            ...prev,
                            { id: `a-${Date.now()}-ig-error`, role: "assistant", type: "text", content: `Error guardando credenciales de Instagram: ${err?.message || err}` },
                          ]);
                        }
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-instagram-configured") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-fuchsia-200">
                    <InstagramConfiguredWidgetExt username={m.username} />
                  </AssistantMessage>
                );
              }
 
              if (m.type === "widget-facebook-auth") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <FacebookAuthWidgetExt
                      widgetId={m.id}
                      onConnected={async (payload) => {
                        try {
                          const access_token = payload?.access_token;
                          const expires_in = payload?.expires_in;
                          const profile = payload?.fb_user || {};
                          const permissions = payload?.granted_scopes || [];
                          const expiresAt = expires_in ? new Date(Date.now() + (Number(expires_in) * 1000)).toISOString() : null;
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) throw new Error("Sesión inválida");
                          const ok = await upsertFacebookToken({
                            userId,
                            token: access_token,
                            expiresAt,
                            fbUserId: profile?.id || null,
                            grantedScopes: permissions,
                            fbName: profile?.name || null,
                          });
                          if (!ok) throw new Error("No fue posible guardar el token en el perfil");
                          const connected = {
                            id: `a-${Date.now()}-fb-ok`,
                            role: "assistant",
                            type: "widget-facebook-connected",
                            name: profile?.name || null,
                            fbId: profile?.id || null,
                            scopes: permissions,
                          };
                          setMessages((prev) => [...prev, connected]);
                          if (userId) {
                            await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-facebook-connected", meta: { name: connected.name, fbId: connected.fbId, scopes: connected.scopes } });
                          }
                        } catch (err) {
                          setMessages((prev) => [
                            ...prev,
                            { id: `a-${Date.now()}-fb-error`, role: "assistant", type: "text", content: `Facebook OAuth error: ${err?.message || err}` },
                          ]);
                        }
                      }}
                      onError={(reason) => {
                        setMessages((prev) => [
                          ...prev,
                          { id: `a-${Date.now()}-fb-error`, role: "assistant", type: "text", content: `Facebook OAuth error: ${reason}` },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-facebook-connected") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <FacebookConnectedWidgetExt name={m.name} fbId={m.fbId} scopes={m.scopes} />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-logout") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-gray-200">
                    <LogoutWidgetExt
                      onLogout={async () => {
                        try {
                          await supabase.auth.signOut();
                          // clear session cache
                          __sessionCache = null;
                          __sessionInflight = null;
                          if (typeof window !== 'undefined' && window.__session_cache_once) {
                            try { delete window.__session_cache_once; } catch {}
                          }
                          setMessages((prev) => [
                            ...prev,
                            { id: `a-${Date.now()}-logout`, role: "assistant", type: "text", content: "Has cerrado sesión correctamente." },
                          ]);
                        } catch (err) {
                          setMessages((prev) => [
                            ...prev,
                            { id: `a-${Date.now()}-logout-error`, role: "assistant", type: "text", content: `Error al cerrar sesión: ${err?.message || err}` },
                          ]);
                        }
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-clear-chat") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-red-200">
                    <ClearChatWidgetExt onClear={async () => {
                      const { data: sessionData } = await getSessionOnce();
                      const userId = sessionData?.session?.user?.id;
                      if (!userId) return;
                      try {
                        const res = await fetch('/api/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
                        if (!res.ok) throw new Error('API clear fallo');
                      } catch (e) {
                        // Fallback: borrar directo con supabase del cliente autenticado
                        if (supabase) {
                          await supabase.from('messages').delete().eq('user_id', userId);
                        }
                      }
                      setMessages([]);
                      await loadHistoryAndNormalize();
                    }} />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-post-publish") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-indigo-200">
                    <PostPublishWidgetExt onContinue={async (selected) => {
                      try {
                        const { data: sessionData } = await getSessionOnce();
                        const userId = sessionData?.session?.user?.id;
                        if (!userId) return;
                        // Guardar en estado y pasar a pedir medios
                        setPublishTargets(selected || []);
                        setPublishStage('await-media');
                        setCustomCaptionMode(false);
                        // Insertar instrucción clara del paso 2 y el widget de espera
                        setMessages((prev) => [
                          ...prev,
                          { id: `a-${Date.now()}-ask-media`, role: 'assistant', type: 'text', content: 'Paso 2: Por favor sube las imágenes o videos para el post.' },
                          { id: `a-${Date.now()}-await-media`, role: 'assistant', type: 'widget-await-media', meta: { targets: selected || [] } },
                        ]);
                        // Persistir ambos mensajes para que no desaparezcan tras recargar
                        await saveMessageToDB({ userId, role: 'assistant', content: 'Paso 2: Por favor sube las imágenes o videos para el post.', attachments: null, type: 'text' });
                        await saveMessageToDB({ userId, role: 'assistant', content: '', attachments: null, type: 'widget-await-media', meta: { targets: selected || [] } });
                        // Persistencia redundante de redes seleccionadas (por si no existe la columna meta)
                        const key = m.widgetKey || m.id;
                        await saveMessageToDB({ userId, role: 'assistant', content: JSON.stringify({ targets: selected || [], widgetKey: key, widgetId: m.id }), attachments: null, type: 'internal-targets' });
                      } catch (e) {
                        setMessages((prev) => [
                          ...prev,
                          { id: `a-${Date.now()}-err`, role: 'assistant', type: 'text', content: 'No pude continuar con el flujo de publicación.' },
                        ]);
                      }
                    }} defaultSelected={widgetTargetDrafts[m.widgetKey || m.id] || []} onChangeTargets={async (arr) => {
                      try {
                        const { data: sessionData } = await getSessionOnce();
                        const userId = sessionData?.session?.user?.id;
                        if (!userId) return;
                        const key = m.widgetKey || m.id;
                        setWidgetTargetDrafts((prev) => ({ ...prev, [key]: arr }));
                        await saveMessageToDB({ userId, role: 'assistant', content: JSON.stringify({ widgetKey: key, widgetId: m.id, targets: arr, draft: true }), attachments: null, type: 'internal-targets' });
                      } catch (_) {}
                    }} />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-await-media") {
                const sel = Array.isArray(m?.meta?.targets) ? m.meta.targets : [];
                return (
                  <AssistantMessage key={m.id} borderClass="border-indigo-100">
                    <div className="text-sm leading-relaxed">
                      <div className="mb-1">Para continuar, adjunta al menos una imagen o video usando el botón de adjuntos debajo del cuadro de texto. Formatos aceptados: JPG, PNG, MP4, MOV, WEBM.</div>
                      {sel && sel.length > 0 && (
                        <div className="text-[11px] text-gray-500">Seleccionaste: {sel.join(', ')}</div>
                      )}
                    </div>
                  </AssistantMessage>
                );
              }
              // NUEVO: Render del widget de sugerencia de descripción
              if (m.type === "widget-caption-suggest") {
                const meta = m.meta || {};
                const caption = meta.caption || '';
                const base = meta.base || '';
                const targets = Array.isArray(meta.targets) ? meta.targets : [];
                return (
                  <AssistantMessage key={m.id} borderClass="border-emerald-200">
                    <CaptionSuggestWidgetExt
                      caption={caption}
                      onAccept={async (finalCaption) => {
                        try {
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          const t = targets && targets.length ? targets.join(', ') : '—';
                          const summary = `Perfecto. Redes: ${t}. Descripción final:\n${finalCaption || caption || base || '—'}`;
                          setMessages((prev) => [
                            ...prev,
                            { id: newId('caption-final'), role: 'assistant', type: 'text', content: summary },
                          ]);
                          if (userId) {
                            await saveMessageToDB({ userId, role: 'assistant', content: summary, attachments: null, type: 'text' });
                          }
                          setPublishStage('idle');
                          setPublishTargets([]);
                          setCustomCaptionMode(false);
                        } catch (_) {}
                      }}
                      onRegenerate={async () => {
                        try {
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          const t = targets && targets.length ? targets.join(', ') : 'generales';
                          const prompt = `Genera una descripción profesional y atractiva en español para redes sociales, con base en este texto del usuario. Requisitos: 2-4 líneas, tono natural y claro, 2-5 hashtags relevantes (sin exceso), 0-2 emojis discretos, incluir un CTA sutil si aplica. Devuelve solo el texto final (sin comillas ni explicaciones).\n\nTexto base:\n${base || caption}\n\nPlataformas destino: ${t}`;
                          const res = await fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
                          });
                          const data = await res.json();
                          const suggestion = (data?.text || '').trim() || caption || base || '';
                          const pre = { id: newId('caption-preface-2'), role: 'assistant', type: 'text', content: 'Otra propuesta:' };
                          const capMeta = { caption: suggestion, base: base || caption || '', targets };
                          const capWidget = { id: newId('caption-suggest-2'), role: 'assistant', type: 'widget-caption-suggest', meta: capMeta };
                          setMessages((prev) => [...prev, pre, capWidget]);
                          if (userId) {
                            await saveMessageToDB({ userId, role: 'assistant', content: pre.content, attachments: null, type: 'text' });
                            await saveMessageToDB({ userId, role: 'assistant', content: '', attachments: null, type: 'widget-caption-suggest', meta: capMeta });
                          }
                        } catch (_) {}
                      }}
                      onCustom={() => {
                        setCustomCaptionMode(true);
                        setMessages((prev) => [
                          ...prev,
                          { id: newId('caption-custom'), role: 'assistant', type: 'text', content: 'Perfecto, escribe la descripción que prefieras y la usaré como final.' },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-youtube-auth") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-red-200">
                    <YouTubeAuthWidgetExt
                      widgetId={m.id}
                      onConnected={async (payload) => {
                        try {
                          const { access_token, expires_in, channel, granted_scopes } = payload || {};
                          const expiresAt = expires_in ? new Date(Date.now() + Number(expires_in) * 1000).toISOString() : null;
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) throw new Error("Sesión inválida");
                          const ok = await upsertYouTubeToken({
                            userId,
                            token: access_token,
                            expiresAt,
                            channelId: channel?.id || null,
                            channelTitle: channel?.title || null,
                            grantedScopes: granted_scopes || [],
                          });
                          if (!ok) throw new Error("No fue posible guardar el token de YouTube");
                          const connected = {
                            id: `a-${Date.now()}-yt-ok`,
                            role: "assistant",
                            type: "widget-youtube-connected",
                            channelId: channel?.id || null,
                            channelTitle: channel?.title || null,
                            grantedScopes: granted_scopes || [],
                            expiresAt,
                          };
                          setMessages((prev) => [...prev, connected]);
                          await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-youtube-connected", meta: { channelId: connected.channelId, channelTitle: connected.channelTitle, grantedScopes: connected.grantedScopes, expiresAt } });
                        } catch (err) {
                          setMessages((prev) => [
                            ...prev,
                            { id: `a-${Date.now()}-yt-error`, role: "assistant", type: "text", content: `YouTube OAuth error: ${err?.message || err}` },
                          ]);
                        }
                      }}
                      onError={(reason) => {
                        setMessages((prev) => [
                          ...prev,
                          { id: `a-${Date.now()}-yt-error`, role: "assistant", type: "text", content: `YouTube OAuth error: ${reason}` },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-youtube-connected") {
                const meta = m.meta || {};
                return (
                  <AssistantMessage key={m.id} borderClass="border-red-200">
                    <YouTubeConnectedWidgetExt
                      channelId={m.channelId ?? meta.channelId}
                      channelTitle={m.channelTitle ?? meta.channelTitle}
                      grantedScopes={m.grantedScopes ?? meta.grantedScopes}
                      expiresAt={m.expiresAt ?? meta.expiresAt}
                    />
                  </AssistantMessage>
                );
              }

              if (m.type === "widget-tiktok-auth") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-gray-300">
                    <TikTokAuthWidgetExt
                      widgetId={m.id}
                      onConnected={async (payload) => {
                        try {
                          const access_token = payload?.access_token || null;
                          const refresh_token = payload?.refresh_token || null;
                          const expires_in = payload?.expires_in || null;
                          const open_id = payload?.open_id || null;
                          const granted_scopes = payload?.granted_scopes || [];
                          const expiresAt = expires_in ? new Date(Date.now() + Number(expires_in) * 1000).toISOString() : null;
                          const { data: sessionData } = await getSessionOnce();
                          const userId = sessionData?.session?.user?.id;
                          if (!userId) throw new Error("Sesión inválida");
                          const ok = await upsertTikTokToken({
                            userId,
                            token: access_token,
                            refreshToken: refresh_token,
                            expiresAt,
                            openId: open_id,
                            grantedScopes: granted_scopes,
                          });
                          if (!ok) throw new Error("No fue posible guardar el token de TikTok");

                          const connected = {
                            id: newId('tt-ok'),
                            role: "assistant",
                            type: "widget-tiktok-connected",
                            openId: open_id || null,
                            grantedScopes: granted_scopes || [],
                            expiresAt,
                          };
                          setMessages((prev) => [...prev, connected]);
                          await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-tiktok-connected", meta: { openId: connected.openId, grantedScopes: connected.grantedScopes, expiresAt } });
                        } catch (err) {
                          setMessages((prev) => [
                            ...prev,
                            { id: newId('tt-error'), role: "assistant", type: "text", content: `TikTok OAuth error: ${err?.message || err}` },
                          ]);
                        }
                      }}
                      onError={(reason) => {
                        setMessages((prev) => [
                          ...prev,
                          { id: newId('tt-error'), role: "assistant", type: "text", content: `TikTok OAuth error: ${reason}` },
                        ]);
                      }}
                    />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-tiktok-connected") {
                const meta = m.meta || {};
                return (
                  <AssistantMessage key={m.id} borderClass="border-gray-300">
                    <TikTokConnectedWidgetExt
                      openId={m.openId ?? meta.openId}
                      grantedScopes={m.grantedScopes ?? meta.grantedScopes}
                      expiresAt={m.expiresAt ?? meta.expiresAt}
                    />
                  </AssistantMessage>
                );
              }

              return (
                <AssistantMessage key={m.id} borderClass="border-gray-200">
                  {m.content}
                </AssistantMessage>
              );
            }
            return (
              <UserMessage key={m.id} attachments={m.attachments} onAttachmentClick={onAttachmentClick}>
                {m.text}
              </UserMessage>
            );
          })}

          {/* Indicador de escritura del asistente */}
          {loading && (
            <AssistantMessage borderClass="border-gray-200">
              <div className="flex items-center gap-2">
                <span className="sr-only">El asistente está escribiendo…</span>
                <div className="flex items-end gap-1" aria-hidden="true">
                  <span className="block h-2.5 w-2.5 rounded-full bg-gray-300 dot"></span>
                  <span className="block h-2.5 w-2.5 rounded-full bg-gray-300 dot"></span>
                  <span className="block h-2.5 w-2.5 rounded-full bg-gray-300 dot"></span>
                </div>
              </div>
              <style jsx>{`
                @keyframes typingBounce { 0%, 80%, 100% { transform: translateY(0); opacity: .6 } 40% { transform: translateY(-3px); opacity: 1 } }
                .dot { animation: typingBounce 1s infinite ease-in-out; }
                .dot:nth-child(2) { animation-delay: .15s; }
                .dot:nth-child(3) { animation-delay: .30s; }
              `}</style>
            </AssistantMessage>
          )}

          {/* Ancla inferior para scroll suave */}
          <li ref={bottomRef} aria-hidden="true" />
        </ul>

        {/* El input (Composer) permanece debajo como antes */}
        <Composer onSend={handleSend} loading={loading || historyLoading} />
      </div>

      {/* Lightbox modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full size-8 flex items-center justify-center shadow ring-1 ring-black/10"
              aria-label="Cerrar"
            >
              ×
            </button>
            <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {lightbox.kind === "video" ? (
                <video src={lightbox.url} controls autoPlay className="max-h-[80vh] w-auto" />
              ) : (
                <img src={lightbox.url} alt={lightbox.name || "media"} className="max-h-[80vh] w-auto" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}