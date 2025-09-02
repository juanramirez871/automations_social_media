"use client";

import { useEffect, useRef, useState } from "react";
import IntroHeader from "@/components/IntroHeader";
import AssistantMessage from "@/components/AssistantMessage";
import UserMessage from "@/components/UserMessage";
import Composer from "@/components/Composer";

export default function Home() {
  // Mensajes UI propios (para soportar adjuntos locales y formato existente)
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // { kind, url, name }

  const handleSend = async ({ text, files }) => {
    const attachments = (files || []).map((f) => {
      const isVideo = f.type?.startsWith("video/") || /\.(mp4|mov|webm|ogg|mkv|m4v)$/i.test(f.name || "");
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
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", type: "text", content: assistantText },
        ]);
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

  const onAttachmentClick = (a) => setLightbox(a);
  const closeLightbox = () => setLightbox(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-pink-50 px-4 sm:px-6 lg:px-8 text-gray-600">
      <div className="max-w-4xl mx-auto">
        <IntroHeader />

        <ul className="mt-16 space-y-5">
          {messages.map((m) => {
            if (m.role === "assistant") {
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
