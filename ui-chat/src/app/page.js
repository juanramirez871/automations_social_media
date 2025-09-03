"use client";

import { useEffect, useRef, useState } from "react";
import IntroHeader from "@/components/IntroHeader";
import AssistantMessage from "@/components/AssistantMessage";
import UserMessage from "@/components/UserMessage";
import Composer from "@/components/Composer";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  // Mensajes UI propios (para soportar adjuntos locales y formato existente)
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Estado de autenticación (demo) y control de una sola aparición
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const authGateShownRef = useRef(false);
  const bottomRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // { kind, url, name }

  // Helper: guardar mensaje en DB (ignora si no hay supabase)
  const saveMessageToDB = async ({ userId, role, content, attachments, type = null, meta = null }) => {
    if (!supabase || !userId) return;
    try {
      await supabase
        .from("messages")
        .insert([{ user_id: userId, role, content, attachments: attachments || null, type, meta }]);
    } catch (e1) {
      try {
        await supabase
          .from("messages")
          .insert([{ user_id: userId, role, content, attachments: attachments || null }]);
      } catch (e2) {
        console.warn("No se pudo guardar el mensaje:", e2?.message || e2);
      }
    }
  };

  // Utilidad: detectar intención de Instagram
  const isInstagramIntent = (t = "") => /\binstagram\b|\big\b|\binsta\b/i.test(String(t || ""));

  // NUEVO: Utilidad: detectar intención de Facebook
  const isFacebookIntent = (t = "") => /\bfacebook\b|\bfb\b/i.test(String(t || ""));
  // Nuevo: YouTube/Shorts
  const isYouTubeIntent = (t = "") => /\byoutube\b|\byt\b|\bshorts\b/i.test(String(t || ""));

  // Nuevo: detectar intención de actualizar credenciales
  const isUpdateCredentialsIntent = (t = "") => {
    const s = String(t || "").toLowerCase();
    const patterns = [
      "actualiza", "actualizar", "actualización",
      "cambia", "cambiar",
      "modifica", "modificar",
      "reconfigura", "reconfigurar",
      "reconecta", "reconectar",
      "reautentica", "reautenticar",
      "relogin", "volver a iniciar sesión",
      "renueva", "renovar",
      "refresh", "refresca", "refrescar",
      "update", "renew",
      "credencial", "credenciales", "token"
    ];
    return patterns.some(p => s.includes(p));
  };

  // Leer credenciales IG del perfil
  const getInstagramCreds = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("instagram_username, instagram_password, userinstagram, passwordinstagram")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      const username = data?.instagram_username || data?.userinstagram || null;
      const password = data?.instagram_password || data?.passwordinstagram || null;
      return { username, password };
    } catch (e) {
      console.warn("No se pudieron obtener credenciales IG:", e?.message || e);
      return { username: null, password: null };
    }
  };

  // Guardar/actualizar credenciales IG en perfil (upsert por id)
  const upsertInstagramCreds = async ({ userId, username, password }) => {
    const row = {
      id: userId,
      instagram_username: username,
      instagram_password: password,
      updated_at: new Date().toISOString(),
    };
    try {
      const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
      if (error) throw error;
      return true;
    } catch (e1) {
      // Fallback: columnas alternativas
      try {
        const { error } = await supabase
          .from("profiles")
          .upsert({ id: userId, userinstagram: username, passwordinstagram: password, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (error) throw error;
        return true;
      } catch (e2) {
        console.warn("No se pudieron guardar credenciales IG:", e2?.message || e2);
        return false;
      }
    }
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
  const loadHistoryForCurrentUser = async () => {
    if (!supabase) return;
    try {
      setHistoryLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const { data: rows, error } = await supabase
        .from("messages")
        .select("id, role, content, attachments, type, meta, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;

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
          if (rType === "widget-instagram-configured") {
            const username = r?.meta?.username || "";
            return { id: r.id, role: "assistant", type: "widget-instagram-configured", username };
          }
          // NUEVO: Facebook widgets
          if (rType === "widget-facebook-auth") {
            return { id: r.id, role: "assistant", type: "widget-facebook-auth" };
          }
          if (rType === "widget-facebook-connected") {
            const fbName = r?.meta?.name || "";
            const fbId = r?.meta?.id || "";
            const scopes = r?.meta?.scopes || null;
            return { id: r.id, role: "assistant", type: "widget-facebook-connected", name: fbName, fbId, scopes };
          }
          // NUEVO: YouTube widgets
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
          // Fallback: texto normal
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

      setMessages(normalized);
      setIsLoggedIn(true);
    } catch (e) {
      console.warn("No se pudo cargar el historial:", e?.message || e);
    } finally {
      setHistoryLoading(false);
    }
  };
  const handleSend = async ({ text, files }) => {
    // Guard: requiere sesión válida
    if (!supabase) {
      // Sin configuración de Supabase: seguir mostrando gate UI-only
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

    // Guardar en DB (guardar URLs de Cloudinary cuando existan)
    const attachmentsForDB = uploadedAttachments.map(({ kind, url, publicId, name }) => ({ kind, url, publicId, name }));
    await saveMessageToDB({ userId, role: "user", content: trimmed, attachments: attachmentsForDB, type: uploadedAttachments.length ? "text+media" : "text" });

    // 1.4) Si el usuario pide actualizar credenciales, mostrar widget de login correspondiente y abortar
    if (isUpdateCredentialsIntent(trimmed) && isInstagramIntent(trimmed)) {
      const widgetId = `a-${Date.now()}-ig-upd`;
      setMessages((prev) => [
        ...prev,
        { id: widgetId, role: "assistant", type: "widget-instagram-credentials" },
      ]);
      await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-instagram-credentials" });
      return;
    }
    if (isUpdateCredentialsIntent(trimmed) && isFacebookIntent(trimmed)) {
      const widgetId = `a-${Date.now()}-fb-upd`;
      setMessages((prev) => [
        ...prev,
        { id: widgetId, role: "assistant", type: "widget-facebook-auth" },
      ]);
      await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-facebook-auth" });
      return;
    }
    if (isUpdateCredentialsIntent(trimmed) && isYouTubeIntent(trimmed)) {
      const widgetId = `a-${Date.now()}-yt-upd`;
      setMessages((prev) => [
        ...prev,
        { id: widgetId, role: "assistant", type: "widget-youtube-auth" },
      ]);
      await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-youtube-auth" });
      return;
    }

    // Dentro de handleSend, después del bloque de Facebook
    if (isYouTubeIntent(trimmed)) {
      let yt = null;
      if (userId) {
        yt = await getYouTubeToken(userId);
      }
      const hasToken = !!yt?.token;
      const widgetId = `a-${Date.now()}-yt`;
      if (!hasToken) {
        setMessages((prev) => [
          ...prev,
          { id: widgetId, role: "assistant", type: "widget-youtube-auth" },
        ]);
        await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-youtube-auth" });
      } else {
        const connected = {
          id: widgetId,
          role: "assistant",
          type: "widget-youtube-connected",
          meta: {
            channelId: yt.channelId,
            channelTitle: yt.channelTitle,
            grantedScopes: yt.grantedScopes,
            expiresAt: yt.expiresAt,
          },
        };
        setMessages((prev) => [...prev, connected]);
        await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-youtube-connected", meta: connected.meta });
      }
      return; // no llamamos a la IA
    }

    // 2) Enviar sólo el texto a la API y agregar la respuesta del asistente
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
        if (data?.widget === "platforms") {
          additions.push({ id: `a-${Date.now()}-w`, role: "assistant", type: "widget-platforms" });
        }
        setMessages((prev) => [...prev, ...additions]);

        // Guardar respuesta del asistente en DB
        if (assistantText) {
          await saveMessageToDB({ userId, role: "assistant", content: assistantText, attachments: null, type: "text" });
        }
        if (data?.widget === "platforms") {
          await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-platforms" });
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

  // Desplazamiento suave hacia el final cuando cambian los mensajes UI o el estado de carga
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Mostrar el widget de autenticación automáticamente cuando no hay login (solo una vez)
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
        await loadHistoryForCurrentUser();
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

  // Widget de autenticación (gate con opciones)
  const AuthGateWidget = () => {
    const openForm = (mode) => {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}-auth-${mode}`, role: "assistant", type: "widget-auth-form", mode },
      ]);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-400 to-sky-400" />
          <p className="text-sm font-semibold text-gray-700">Autenticación requerida</p>
        </div>
        <p className="text-sm text-gray-600">Para continuar, elige una opción:</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openForm("login")}
            className="px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 transition"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => openForm("signup")}
            className="px-3 py-1.5 rounded-full border border-pink-200 text-pink-700 bg-pink-50/60 hover:bg-pink-100 transition"
          >
            Crear cuenta
          </button>
        </div>
        <p className="text-xs text-gray-400">Demo: sin lógica de backend ni validaciones.</p>
      </div>
    );
  };

  // Formulario inline (login o signup) dentro del chat
  const AuthFormWidget = ({ mode }) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [confirm, setConfirm] = useState("");

    const handleSubmit = async (e) => {
      e.preventDefault();

      if (supabase) {
        try {
          if (mode === "signup") {
            const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name } } });
            if (error) throw error;
          } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;
          }
          await loadHistoryForCurrentUser();
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}-auth-ok`, role: "assistant", type: "text", content: "Ingreso exitoso 🥳." },  
          ]);
          return;
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}-auth-error`, role: "assistant", type: "text", content: `Error de autenticación: ${err.message}` },
          ]);
          return;
        }
      }

      // Fallback si no hay supabase configurado
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-auth-submitted`,
          role: "assistant",
          type: "text",
          content: `Formulario de ${mode === "login" ? "inicio de sesión" : "creación de cuenta"} recibido (demo).`,
        },
      ]);
    };

    const submitBtnGradient = "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-500/90 hover:to-blue-600/90";

    return (
      <div className="space-y-4 w-full sm:w-[34rem] md:w-[40rem]">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-400 to-sky-400" />
          <p className="text-sm font-semibold text-gray-700">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300"
                placeholder="Tu nombre"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300"
              placeholder="••••••••"
            />
          </div>
          {mode === "signup" && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300"
                placeholder="••••••••"
              />
            </div>
          )}
          <button
            type="submit"
            className={`w-full inline-flex justify-center items-center rounded-lg text-white ${submitBtnGradient} px-4 py-2 text-sm`}
          >
            {mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    );
  };

  // Widget: pedir credenciales de Instagram
  const InstagramCredentialsWidget = ({ widgetId }) => {
    const [u, setU] = useState("");
    const [p, setP] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
      e.preventDefault();
      if (!u || !p) return;
      setSaving(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) throw new Error("Sesión inválida");
        const ok = await upsertInstagramCreds({ userId, username: u, password: p });
        if (!ok) throw new Error("No fue posible guardar credenciales");

        // Quitar este widget
        setMessages((prev) => prev.filter((m) => m.id !== widgetId));

        // Insertar widget configurado y persistirlo en DB
        const configured = { id: `a-${Date.now()}-ig-ok`, role: "assistant", type: "widget-instagram-configured", username: u };
        setMessages((prev) => [...prev, configured]);

        const { data: sessionData2 } = await supabase.auth.getSession();
        const userId2 = sessionData2?.session?.user?.id;
        if (userId2) {
          await saveMessageToDB({ userId: userId2, role: "assistant", content: "", attachments: null, type: "widget-instagram-configured", meta: { username: u } });
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}-ig-error`, role: "assistant", type: "text", content: `Error guardando credenciales de Instagram: ${err?.message || err}` },
        ]);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-400" />
          <p className="text-sm font-semibold text-gray-700">Conectar Instagram</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Instagram</p>
            <p className="text-xs text-gray-500">Ingresa tus credenciales</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" value={u} onChange={(e) => setU(e.target.value)} placeholder="Usuario de Instagram" className="w-full rounded-lg border border-fuchsia-200 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-fuchsia-300" />
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="Contraseña de Instagram" className="w-full rounded-lg border border-fuchsia-200 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-fuchsia-300" />
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving || !u || !p} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-white text-sm disabled:opacity-50">
              {saving ? (
                <span className="size-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
              ) : (
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M5 12l5 5L20 7"/></svg>
              )}
              Guardar y continuar
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400">Aviso: las credenciales se guardan en tu perfil.</p>
      </div>
    );
  };

  // Widget: Instagram configurado
  const InstagramConfiguredWidget = ({ username }) => (
    <div className="flex items-center gap-3">
      <div className="relative size-10 shrink-0 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 flex items-center justify-center shadow-inner">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path fill="#fff" d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">Instagram conectado</p>
        <p className="text-xs text-gray-500">@{username} listo para publicar</p>
      </div>
    </div>
  );
  
  // NUEVO: Facebook - Widget de autenticación
  const FacebookAuthWidget = ({ widgetId }) => {
    const [connecting, setConnecting] = useState(false);
  
    useEffect(() => {
      const onMsg = async (ev) => {
        try {
          if (!ev?.data || ev.data?.source !== 'fb-oauth') return;
          if (ev.origin !== window.location.origin) return;
  
          if (!ev.data.ok) {
            setMessages((prev) => [
              ...prev,
              { id: `a-${Date.now()}-fb-error`, role: "assistant", type: "text", content: `Facebook OAuth error: ${ev.data.error}` },
            ]);
            setConnecting(false);
            return;
          }
  
          const d = ev.data.data || {};
          const access_token = d.access_token;
          const expires_in = d.expires_in;
          const profile = d.fb_user || {};
          const permissions = d.granted_scopes || [];
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
  
          // Quitar este widget
          setMessages((prev) => prev.filter((m) => m.id !== widgetId));
  
          // Insertar widget conectado y persistirlo en DB (sin token)
          const connected = {
            id: `a-${Date.now()}-fb-ok`,
            role: "assistant",
            type: "widget-facebook-connected",
            name: profile?.name || "Facebook user",
            fbId: profile?.id || "",
            scopes: permissions || null,
          };
          setMessages((prev) => [...prev, connected]);
          await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-facebook-connected", meta: { name: connected.name, id: connected.fbId, scopes: connected.scopes } });
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}-fb-error2`, role: "assistant", type: "text", content: `No se pudo completar Facebook OAuth: ${err?.message || err}` },
          ]);
        } finally {
          setConnecting(false);
        }
      };
      window.addEventListener('message', onMsg);
      return () => window.removeEventListener('message', onMsg);
    }, [widgetId]);
  
    const startLogin = () => {
      setConnecting(true);
      const w = 600, h = 700;
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
      const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
      const left = ((width - w) / 2) + dualScreenLeft;
      const top = ((height - h) / 2) + dualScreenTop;
      window.open(
        "/api/facebook/login",
        "fb_oauth",
        `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
      );
    };
  
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M13.4 21v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.3-1.3 1.3-1.3h1.5V5c-.3 0-1.1-.1-2.1-.1-2 0-3.4 1.2-3.4 3.5v2H8.4V14h2.3v7h2.7z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Facebook</p>
            <p className="text-xs text-gray-500">Conectar con OAuth</p>
          </div>
        </div>
        <button
          type="button"
          onClick={startLogin}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-white text-sm disabled:opacity-50"
        >
          {connecting ? (
            <span className="size-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M5 12l5 5L20 7"/></svg>
          )}
          {connecting ? "Conectando…" : "Login con Facebook"}
        </button>
      </div>
    );
  };
  
  // NUEVO: Facebook - Widget conectado
  const FacebookConnectedWidget = ({ name, fbId, scopes }) => (
    <div className="flex items-center gap-3">
      <div className="relative size-10 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-inner">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path fill="#fff" d="M13.4 21v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.3-1.3 1.3-1.3h1.5V5c-.3 0-1.1-.1-2.1-.1-2 0-3.4 1.2-3.4 3.5v2H8.4V14h2.3v7h2.7z"/>
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">Facebook conectado</p>
        <p className="text-xs text-gray-500">{name ? `${name} (${fbId})` : `ID ${fbId}`}</p>
        {Array.isArray(scopes) && scopes.length > 0 && (
          <p className="text-xs text-gray-400 mt-1">Permisos: {scopes.join(", ")}</p>
        )}
      </div>
    </div>
  );
  
  const PlatformsWidget = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-400 to-sky-400" />
        <p className="text-sm font-semibold text-gray-700">Plataformas que manejo</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Facebook */}
        <div className="group flex items-center gap-3 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M13.4 21v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.3-1.3 1.3-1.3h1.5V5c-.3 0-1.1-.1-2.1-.1-2 0-3.4 1.2-3.4 3.5v2h-2.3V14h2.3v7h2.7z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Facebook</p>
            <p className="text-xs text-gray-500">Páginas y publicaciones</p>
          </div>
        </div>
        {/* Instagram */}
        <div className="group flex items-center gap-3 rounded-xl border border-fuchsia-100 bg-gradient-to-br from-white to-fuchsia-50/30 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-500 flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="#fff" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Instagram</p>
            <p className="text-xs text-gray-500">Feed, Reels y Stories</p>
          </div>
        </div>
        {/* YouTube */}
        <div className="group flex items-center gap-3 rounded-xl border border-red-100 bg-gradient-to-br from-white to-red-50/30 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-xl bg-[#FF0000] flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M10 15.5v-7l6 3.5-6 3.5z"/>
              <rect x="3" y="6" width="18" height="12" rx="3" ry="3" fill="none" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">YouTube</p>
            <p className="text-xs text-gray-500">Videos y Shorts</p>
          </div>
        </div>
        {/* TikTok */}
        <div className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-full bg-black flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M16.5 7.5c1.1.9 2.4 1.4 3.8 1.5v2.3c-1.6-.1-3.1-.7-4.4-1.7v4.9c0 2.8-2.2 5-5 5s-5-2.2-5-5 2.2-5 5-5c.4 0 .7 0 1 .1v2.4c-.3-.1-.6-.1-1-.1-1.5 0-2.7 1.2-2.7 2.7S9.4 20 11 20s2.7-1.2 2.7-2.7V4h2.8v3.5z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">TikTok</p>
            <p className="text-xs text-gray-500">Clips y tendencias</p>
          </div>
        </div>
      </div>
    </div>
  );

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
                    <PlatformsWidget />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-auth-gate") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <AuthGateWidget />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-auth-form") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <AuthFormWidget mode={m.mode} />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-instagram-credentials") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-fuchsia-200">
                    <InstagramCredentialsWidget widgetId={m.id} />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-instagram-configured") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-fuchsia-200">
                    <InstagramConfiguredWidget username={m.username} />
                  </AssistantMessage>
                );
              }
              // NUEVO: Facebook auth y conectado
              if (m.type === "widget-facebook-auth") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <FacebookAuthWidget widgetId={m.id} />
                  </AssistantMessage>
                );
              }
              if (m.type === "widget-facebook-connected") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-blue-200">
                    <FacebookConnectedWidget name={m.name} fbId={m.fbId} scopes={m.scopes} />
                  </AssistantMessage>
                );
              }
              // NUEVO: YouTube auth y conectado
              if (m.type === "widget-youtube-auth") {
                return (
                  <AssistantMessage key={m.id} borderClass="border-red-200">
                    <YouTubeAuthWidget
                      widgetId={m.id}
                      onConnected={async (meta) => {
                        // Remover el widget de auth
                        setMessages((prev) => prev.filter((x) => x.id !== m.id));
                        // Insertar widget conectado
                        const connected = {
                          id: `a-${Date.now()}-yt-ok`,
                          role: "assistant",
                          type: "widget-youtube-connected",
                          meta: {
                            channelId: meta?.channelId || null,
                            channelTitle: meta?.channelTitle || null,
                            grantedScopes: meta?.grantedScopes || null,
                            expiresAt: meta?.expiresAt || null,
                          },
                        };
                        setMessages((prev) => [...prev, connected]);
                        // Persistir en DB
                        const { data: sessionData } = await supabase.auth.getSession();
                        const userId = sessionData?.session?.user?.id;
                        if (userId) {
                          await saveMessageToDB({ userId, role: "assistant", content: "", attachments: null, type: "widget-youtube-connected", meta: connected.meta });
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
                    <YouTubeConnectedWidget
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

// NUEVO: Leer token de Facebook del perfil
const getFacebookToken = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("facebook_access_token, facebook_expires_at, facebook_user_id, facebook_granted_scopes")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const token = data?.facebook_access_token || null;
    const expiresAt = data?.facebook_expires_at || null;
    const fbUserId = data?.facebook_user_id || null;
    const grantedScopes = data?.facebook_granted_scopes || null;
    return { token, expiresAt, fbUserId, grantedScopes };
  } catch (e) {
    console.warn("No se pudo obtener token de Facebook:", e?.message || e);
    return { token: null, expiresAt: null, fbUserId: null, grantedScopes: null };
  }
};

// NUEVO: Guardar/actualizar token de Facebook en perfil
const upsertFacebookToken = async ({ userId, token, expiresAt = null, fbUserId = null, grantedScopes = null, fbName = null }) => {
  try {
    const row = {
      id: userId,
      facebook_access_token: token,
      facebook_expires_at: expiresAt,
      facebook_user_id: fbUserId,
      facebook_granted_scopes: grantedScopes,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("No se pudo guardar token de Facebook:", e?.message || e);
    return false;
  }
};

// NUEVO: Leer token de YouTube del perfil
const getYouTubeToken = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("youtube_access_token, youtube_refresh_token, youtube_expires_at, youtube_channel_id, youtube_channel_title, youtube_granted_scopes")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const token = data?.youtube_access_token || null;
    const refreshToken = data?.youtube_refresh_token || null;
    const expiresAt = data?.youtube_expires_at || null;
    const channelId = data?.youtube_channel_id || null;
    const channelTitle = data?.youtube_channel_title || null;
    const grantedScopes = data?.youtube_granted_scopes || null;
    return { token, refreshToken, expiresAt, channelId, channelTitle, grantedScopes };
  } catch (e) {
    console.warn("No se pudo obtener token de YouTube:", e?.message || e);
    return { token: null, refreshToken: null, expiresAt: null, channelId: null, channelTitle: null, grantedScopes: null };
  }
};

// NUEVO: Guardar/actualizar token de YouTube en perfil
const upsertYouTubeToken = async ({ userId, token, refreshToken = null, expiresAt = null, channelId = null, channelTitle = null, grantedScopes = null }) => {
  try {
    const row = {
      id: userId,
      youtube_access_token: token,
      youtube_refresh_token: refreshToken,
      youtube_expires_at: expiresAt,
      youtube_channel_id: channelId,
      youtube_channel_title: channelTitle,
      youtube_granted_scopes: grantedScopes,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("No se pudo guardar token de YouTube:", e?.message || e);
    return false;
  }
};

// YouTube widgets
const YouTubeAuthWidget = ({ widgetId, onConnected, onError }) => {
  const [connecting, setConnecting] = useState(false);
  const handledRef = useRef(false);
  useEffect(() => {
    const onMsg = async (ev) => {
      try {
        if (!ev?.data || ev.origin !== window.location.origin) return;
        if (ev.data?.source !== 'yt-oauth') return;
        // Evitar manejar el evento múltiples veces (varios widgets montados o StrictMode)
        if (handledRef.current || (typeof window !== 'undefined' && window.__yt_oauth_handled)) return;
        handledRef.current = true;
        if (typeof window !== 'undefined') window.__yt_oauth_handled = true;

        if (!ev.data.ok) {
          setConnecting(false);
          onError && onError(ev.data?.reason || 'oauth_error');
          return;
        }
        const d = ev.data.data || {};
        const access_token = d.access_token;
        const refresh_token = d.refresh_token || null;
        const expires_at = d.expires_at || null;
        const channel_id = d.channel_id || null;
        const channel_title = d.channel_title || null;
        const granted_scopes = d.granted_scopes || null;
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (userId && access_token) {
          await upsertYouTubeToken({ userId, token: access_token, refreshToken: refresh_token, expiresAt: expires_at, channelId: channel_id, channelTitle: channel_title, grantedScopes: granted_scopes });
        }
        setConnecting(false);
        onConnected && onConnected({ channelId: channel_id, channelTitle: channel_title, grantedScopes: granted_scopes, expiresAt: expires_at });
      } catch (e) {
        setConnecting(false);
        onError && onError(e?.message || 'exception');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onConnected, onError]);
 
  const startLogin = () => {
    setConnecting(true);
    // Resetear flag global en un nuevo intento
    if (typeof window !== 'undefined') window.__yt_oauth_handled = false;
    const w = 600, h = 700;
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = ((width - w) / 2) + dualScreenLeft;
    const top = ((height - h) / 2) + dualScreenTop;
    window.open(
      "/api/youtube/login",
      "yt_oauth",
      `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative size-10 shrink-0 rounded-xl bg-[#FF0000] flex items-center justify-center shadow-inner">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="#fff" d="M10 15.5v-7l6 3.5-6 3.5z"/>
            <rect x="3" y="6" width="18" height="12" rx="3" ry="3" fill="none" stroke="#fff" strokeWidth="2"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">YouTube</p>
          <p className="text-xs text-gray-500">Conectar con OAuth</p>
        </div>
      </div>
      <button
        type="button"
        onClick={startLogin}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-lg bg-[#FF0000] px-4 py-2 text-white text-sm disabled:opacity-50"
      >
        {connecting ? (
          <span className="size-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M5 12l5 5L20 7"/></svg>
        )}
        {connecting ? "Conectando…" : "Login con YouTube"}
      </button>
    </div>
  );
};

const YouTubeConnectedWidget = ({ channelId, channelTitle, grantedScopes, expiresAt }) => (
  <div className="flex items-center gap-3">
    <div className="relative size-10 shrink-0 rounded-xl bg-[#FF0000] flex items-center justify-center shadow-inner">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#fff" d="M10 15.5v-7l6 3.5-6 3.5z"/>
        <rect x="3" y="6" width="18" height="12" rx="3" ry="3" fill="none" stroke="#fff" strokeWidth="2"/>
      </svg>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-800">YouTube conectado</p>
      {channelTitle && <p className="text-xs text-gray-500">{channelTitle} ({channelId})</p>}
      {Array.isArray(grantedScopes) && grantedScopes.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">Permisos: {grantedScopes.join(", ")}</p>
      )}
      {expiresAt && (
        <p className="text-[11px] text-gray-400 mt-1">Token expira: {new Date(expiresAt).toLocaleString()}</p>
      )}
    </div>
  </div>
);
