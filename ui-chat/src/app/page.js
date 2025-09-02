"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from '@ai-sdk/react';

export default function Home() {
  const {
    messages,
    status,
    sendMessage
  } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: 'text', text: "¡Hola! Soy tu asistente con IA. ¿En qué te ayudo hoy?" }],
      },
    ],
  });

  const [input, setInput] = useState('');
  const [pendingMedia, setPendingMedia] = useState([]); // {id, url, type, name, size}
  const listRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);

  const MAX_FILES = 6;
  const MAX_FILE_MB = 25; // límite suave por archivo

  // Auto-scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const isBusy = status === 'submitted' || status === 'streaming';

  const canSend = useMemo(
    () => (input.trim().length > 0 || pendingMedia.length > 0) && !isBusy,
    [input, pendingMedia.length, isBusy]
  );

  const onPickFiles = (files) => {
    const items = Array.from(files || []);
    if (!items.length) return;
    setPendingMedia((prev) => {
      const remaining = Math.max(0, MAX_FILES - prev.length);
      const next = [];
      for (const f of items.slice(0, remaining)) {
        const type = f.type.startsWith("image/")
          ? "image"
          : f.type.startsWith("video/")
            ? "video"
            : null;
        if (!type) continue;
        const sizeMB = f.size / (1024 * 1024);
        if (sizeMB > MAX_FILE_MB) continue;
        next.push({
          id: crypto.randomUUID(),
          url: URL.createObjectURL(f),
          type,
          name: f.name,
          size: f.size,
        });
      }
      return [...prev, ...next];
    });
  };

  const removePending = (id) => {
    setPendingMedia((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  // Drag & drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setDragActive(true);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) onPickFiles(files);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!canSend) return;
    
    let messageContent = input.trim();
    
    // Si hay archivos adjuntos, agregar información sobre ellos
    if (pendingMedia.length > 0) {
      const mediaInfo = pendingMedia.map(m => `[${m.type}: ${m.name}]`).join(', ');
      messageContent = messageContent ? `${messageContent}\n\nArchivos adjuntos: ${mediaInfo}` : `Archivos adjuntos: ${mediaInfo}`;
    }
    
    // Limpiar archivos pendientes e input
    pendingMedia.forEach(m => URL.revokeObjectURL(m.url));
    setPendingMedia([]);
    setInput('');
    
    // Enviar mensaje usando useChat v5
    sendMessage({ text: messageContent });
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className={`min-h-dvh transition-all duration-300 ${
      dragActive 
        ? 'bg-gradient-to-b from-sky-50/80 to-white/80 backdrop-blur-md' 
        : 'bg-gradient-to-b from-sky-50 to-white'
    } text-gray-900`}>
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-sky-900">
            Chat IA
          </h1>
          <span className="text-xs sm:text-sm text-sky-700/80 bg-sky-100 px-2 py-1 rounded-full">
            {isBusy ? 'Pensando...' : 'En línea'}
          </span>
        </div>

        <section
          className={`transition-all duration-300 ${
            dragActive 
              ? 'bg-white/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/40 border-2 border-sky-300 shadow-2xl' 
              : 'bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border border-sky-100 shadow-sm'
          } rounded-2xl overflow-hidden relative`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="mx-4 w-full max-w-sm rounded-2xl border-2 border-dashed border-sky-300 bg-white/60 backdrop-blur-xl p-6 text-center text-sky-900 shadow-2xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100/80 backdrop-blur text-sky-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path d="M12 2a.75.75 0 0 1 .75.75V14a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 12 2Zm-5.47 6.53a.75.75 0 0 1 1.06 0L12 12.94l4.41-4.41a.75.75 0 0 1 1.06 1.06l-4.94 4.95a1.5 1.5 0 0 1-2.12 0L6.53 9.59a.75.75 0 0 1 0-1.06ZM4 17.25A2.75 2.75 0 0 1 6.75 14.5h10.5A2.75 2.75 0 0 1 20 17.25v.5A2.25 2.25 0 0 1 17.75 20H6.25A2.25 2.25 0 0 1 4 17.75v-.5Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium">Suelta imágenes o videos para adjuntar</p>
                <p className="mt-1 text-xs text-sky-700/80">Hasta {MAX_FILES} archivos, máx {MAX_FILE_MB} MB c/u</p>
              </div>
            </div>
          )}
          
          {/* Cabecera */}
          <div className={`px-4 sm:px-5 py-3 border-b border-sky-100 transition-all duration-300 ${
            dragActive 
              ? 'bg-gradient-to-r from-white/60 to-sky-50/60 backdrop-blur-xl' 
              : 'bg-gradient-to-r from-white to-sky-50'
          } flex items-center gap-3`}>
            <div className="size-8 rounded-full bg-sky-200 text-sky-900 flex items-center justify-center font-semibold select-none">
              🤖
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-sky-900">Asistente IA</p>
              <p className="text-xs text-sky-700/80">Powered by Google Gemini</p>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div ref={listRef} className={`h-[60vh] sm:h-[65vh] overflow-y-auto px-3 sm:px-4 py-4 space-y-4 transition-all duration-300 ${
            dragActive ? 'bg-white/40 backdrop-blur-xl' : 'bg-white'
          }`}>
            {messages.map((m) => {
              const text = Array.isArray(m.parts)
                ? m.parts.map(p => p.type === 'text' ? p.text : '').join('')
                : (m.content ?? '');
              return (
                <MessageBubble key={m.id} role={m.role} text={text} attachments={[]} dragActive={dragActive} />
              );
            })}
            {(status === 'submitted' || status === 'streaming') && (
              <MessageBubble role="assistant" text="Escribiendo…" typing dragActive={dragActive} />
            )}
          </div>

          {/* Entrada de texto */}
          <div className={`border-t border-sky-100 transition-all duration-300 ${
            dragActive ? 'bg-white/40 backdrop-blur-xl' : 'bg-white'
          } p-3 sm:p-4`}>
            {/* Previsualizaciones */}
            {pendingMedia.length > 0 && (
              <div className="mb-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pendingMedia.map((m) => (
                  <div key={m.id} className="relative group rounded-lg overflow-hidden border border-sky-100 bg-sky-50">
                    {m.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.name} className="h-24 w-full object-cover" />
                    ) : (
                      <video src={m.url} className="h-24 w-full object-cover" muted playsInline />
                    )}
                    <button
                      onClick={() => removePending(m.id)}
                      className="absolute top-1 right-1 inline-flex items-center justify-center size-6 rounded-full bg-white/95 text-sky-900 shadow hover:bg-white"
                      aria-label="Quitar adjunto"
                      type="button"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <label className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-900 shadow-inner shadow-sky-100/50 px-3 py-2 sm:px-3.5 sm:py-2 hover:bg-sky-100 cursor-pointer" title="Adjuntar imagen o video">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
                  <path d="M18.364 5.636a4.5 4.5 0 0 0-6.364 0l-7.071 7.07a4 4 0 1 0 5.657 5.657l1.415-1.414a1 1 0 1 0-1.415-1.415l-1.414 1.415a2 2 0 1 1-2.828-2.829l7.07-7.071a2.5 2.5 0 1 1 3.536 3.536l-3.536 3.536a1 1 0 0 0 1.415 1.415l3.536-3.536a4.5 4.5 0 0 0 0-6.364Z" />
                </svg>
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Escribe un mensaje…"
                className="flex-1 resize-none rounded-xl border border-sky-200 focus:border-sky-300 focus:outline-none bg-sky-50/50 placeholder:text-sky-600/60 text-sky-900 px-3 py-2 sm:px-4 sm:py-2.5 shadow-inner shadow-sky-100/50"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-medium shadow-sm enabled:hover:bg-sky-700 enabled:active:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Enviar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-5"
                  aria-hidden="true"
                >
                  <path d="M3.105 2.316a.75.75 0 0 1 .82-.1l13.5 6.75a.75.75 0 0 1 0 1.368l-13.5 6.75a.75.75 0 0 1-1.05-.918L4.64 10 2.375 3.234a.75.75 0 0 1 .73-.918ZM5.748 10.5l-1.69 4.506L15.065 10 4.058 5.006 5.748 9.5h5.127a.75.75 0 0 1 0 1.5H5.748Z" />
                </svg>
                Enviar
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function MessageBubble({ role, text, attachments = [], typing = false, dragActive = false }) {
  const isUser = role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="size-7 shrink-0 rounded-full bg-sky-200 text-sky-900 flex items-center justify-center text-xs font-semibold select-none">
          🤖
        </div>
      )}
      <div
        className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 text-sm shadow transition-all duration-300 ${
          isUser
            ? dragActive 
              ? "bg-sky-100/80 backdrop-blur text-sky-900 rounded-br-sm shadow-sky-100/50" 
              : "bg-sky-100 text-sky-900 rounded-br-sm shadow-sky-100"
            : dragActive 
              ? "bg-gray-100/80 backdrop-blur text-gray-900 rounded-bl-sm shadow-gray-100/50" 
              : "bg-gray-100 text-gray-900 rounded-bl-sm shadow-gray-100"
        }`}
      >
        {typing ? (
          <TypingDots />
        ) : (
          <>
            {attachments?.length > 0 && (
              <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="overflow-hidden rounded-lg border border-white/40">
                    {att.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.url} alt={att.name || "imagen"} className="w-full h-48 object-cover" />
                    ) : (
                      <video src={att.url} className="w-full h-48 object-cover" controls playsInline />
                    )}
                  </div>
                ))}
              </div>
            )}
            {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
          </>
        )}
      </div>
      {isUser && (
        <div className="size-7 shrink-0 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-semibold select-none">
          Tú
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-.2s]"></span>
      <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-.1s]"></span>
      <span className="size-1.5 rounded-full bg-current animate-bounce"></span>
    </span>
  );
}
