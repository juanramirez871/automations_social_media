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
  // Estado de autenticación (demo) y control de una sola aparición
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const authGateShownRef = useRef(false);
  
  const bottomRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // { kind, url, name }

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

    const { data } = await supabase.auth.getSession();
    const hasSession = Boolean(data?.session);
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
    const attachments = (files || []).map((f) => {
      const isVideo = f.type?.startsWith("video/") || /(\.(mp4|mov|webm|ogg|mkv|m4v))$/i.test(f.name || "");
      const kind = isVideo ? "video" : "image";
      const url = URL.createObjectURL(f);
      return { kind, url, name: f.name };
    });

    // 1) Agregar el mensaje del usuario a la UI
    const userMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      type: attachments.length ? "text+media" : "text",
      text: text || "",
      attachments,
    };
    setMessages((prev) => [...prev, userMessage]);

    // 2) Enviar sólo el texto a la API y agregar la respuesta del asistente
    const trimmed = (text || "").trim();
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
      setIsLoggedIn(hasSession);
      if (!hasSession && !authGateShownRef.current) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}-auth-gate`, role: "assistant", type: "widget-auth-gate" },
        ]);
        authGateShownRef.current = true;
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
            setIsLoggedIn(true);
          } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;
            setIsLoggedIn(true);
          }
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

  // Widget de plataformas soportadas
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
        <Composer onSend={handleSend} loading={loading} />
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
