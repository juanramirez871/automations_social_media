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

    // 1.5) Si la intención es Instagram y no hay credenciales en perfil, mostrar widget para ingresarlas y abortar envío a la IA
    if (isInstagramIntent(trimmed)) {
      const { username, password } = await getInstagramCreds(userId);
      if (!username || !password) {
        const widgetId = `a-${Date.now()}-ig-cred`;
        setMessages((prev) => [
          ...prev,
          { id: widgetId, role: "assistant", type: "widget-instagram-credentials" },
        ]);
        return; // no llamamos a la IA hasta tener credenciales
      }
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
