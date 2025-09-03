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
import { LogoutWidget as LogoutWidgetExt, ClearChatWidget as ClearChatWidgetExt, PlatformsWidget as PlatformsWidgetExt } from "@/components/widgets/ControlWidgets";
import { upsertInstagramCreds, upsertFacebookToken, upsertYouTubeToken } from "@/lib/apiHelpers";
import { saveMessageToDB, loadHistoryForCurrentUser } from "@/lib/databaseUtils";
// import { detectInstagramIntent, detectUpdateCredentialsIntent, detectFacebookIntent, detectYouTubeIntent, showPlatformsWidgetHeuristic, showPlatformsWidgetByTool } from "@/lib/intentDetection";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const authGateShownRef = useRef(false);
  const bottomRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

  // Subir archivo a Cloudinary vía API interna

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
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const rows = await loadHistoryForCurrentUser();

      const normalized = (rows || []).map((r) => {
        const rType = r.type || (r.role === "user" ? (Array.isArray(r.attachments) && r.attachments.length ? "text+media" : "text") : "text");

        // Render según type almacenado
        if (r.role === "assistant") {
          if (rType === "widget-platforms") {
            return { id: r.id, role: "assistant", type: "widget-platforms" };
          }
          if (rType === "widget-auth-gate") {
            // Por defecto no re-renderizamos el gate tras login.
          }
          if (rType === "widget-auth-form") {
            const mode = r?.meta?.mode || "login";
            return { id: r.id, role: "assistant", type: "widget-auth-form", mode };
          }
          if (rType === "widget-instagram-credentials") {
            return { id: r.id, role: "assistant", type: "widget-instagram-credentials" };
          }
          if (rType === "widget-instagram-configured") {
            const username = r?.meta?.username || "";
            return { id: r.id, role: "assistant", type: "widget-instagram-configured", username };
          }

          if (rType === "widget-facebook-auth") {
            return { id: r.id, role: "assistant", type: "widget-facebook-auth" };
          }
          if (rType === "widget-facebook-connected") {
            const fbName = r?.meta?.name || "";
            const fbId = r?.meta?.id || "";
            const scopes = r?.meta?.scopes || null;
            return { id: r.id, role: "assistant", type: "widget-facebook-connected", name: fbName, fbId, scopes };
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
          if (rType === "widget-logout") {
            return { id: r.id, role: "assistant", type: "widget-logout" };
          }
          if (rType === "widget-clear-chat") {
            return { id: r.id, role: "assistant", type: "widget-clear-chat" };
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

      setMessages((prev) => {
        const histIds = new Set((normalized || []).map((m) => m.id));
        const keep = (prev || []).filter((m) => !histIds.has(m?.id));
        return [...normalized, ...keep];
      });
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

    const { data: sessionData } = await supabase.auth.getSession();
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
          "instagram-credentials": "widget-instagram-credentials",
          "facebook-auth": "widget-facebook-auth",
          "youtube-auth": "widget-youtube-auth",
          logout: "widget-logout",
          "clear-chat": "widget-clear-chat",
        };

        for (const w of widgets) {
          const t = widgetTypeMap[w];
          if (t) {
            additions.push({ id: `a-${Date.now()}-w-${w}`, role: "assistant", type: t });
          }
        }

        setMessages((prev) => [...prev, ...additions]);

        // Guardar respuesta del asistente y widgets en DB
        if (assistantText) {
          await saveMessageToDB({ userId, role: "assistant", content: assistantText, attachments: null, type: "text" });
        }
        for (const w of widgets) {
          const t = widgetTypeMap[w];
          if (t) {
            await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: t });
          }
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
      const { data } = await supabase.auth.getSession();
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
                        const { data: sessionData } = await supabase.auth.getSession();
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
                          const { data: sessionData2 } = await supabase.auth.getSession();
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
                          const { data: sessionData } = await supabase.auth.getSession();
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
                    <ClearChatWidgetExt
                      onClear={() => {
                        setMessages([
                          { id: '1', role: 'assistant', type: 'text', content: 'Hola! Soy tu asistente de redes sociales. ¿En qué plataforma quieres trabajar hoy? Escribe "plataformas" para ver opciones.' },
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
                          const { data: sessionData } = await supabase.auth.getSession();
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