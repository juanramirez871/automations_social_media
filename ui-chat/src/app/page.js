"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from '@ai-sdk/react';
import 'flowbite';

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
        parts: [{ type: 'text', text: "¡Hola! Soy Roro, tu asistente profesional y amigable para automatizar publicaciones en Instagram y Facebook. ¿Te ayudo a crear o programar una publicación?" }],
      },
    ],
  });

  const [input, setInput] = useState('');
  const [pendingMedia, setPendingMedia] = useState([]);
  const listRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);

  const MAX_FILES = 6;
  const MAX_FILE_MB = 25;

  // Prompts rápidos inspirados en el snippet del usuario
  const quickPrompts = [
    'Ayúdame con una receta fácil de cheesecake con ingredientes sencillos',
    'Redacta un copy breve y divertido para un post de Instagram sobre cafés de especialidad',
    'Dame 3 ideas de Reels para promocionar un lanzamiento esta semana'
  ];

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, status]);

  const isBusy = status === 'submitted' || status === 'streaming';

  const canSend = useMemo(
    () => (input.trim().length > 0 || pendingMedia.length > 0) && !isBusy,
    [input, pendingMedia.length, isBusy]
  );

  // Mostrar saludo dentro del chat hasta que exista un mensaje del usuario
  const hasUserMessage = useMemo(() => messages.some(m => m.role === 'user'), [messages]);
  const showWelcomeInside = !hasUserMessage;
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
        next.push({ id: crypto.randomUUID(), url: URL.createObjectURL(f), type, name: f.name, size: f.size });
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

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current += 1; setDragActive(true); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current = Math.max(0, dragCounter.current - 1); if (dragCounter.current === 0) setDragActive(false); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragActive(false); const files = e.dataTransfer?.files; if (files && files.length) onPickFiles(files); };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!canSend) return;
    let messageContent = input.trim();
    if (pendingMedia.length > 0) {
      const mediaInfo = pendingMedia.map(m => `[${m.type}: ${m.name}]`).join(', ');
      messageContent = messageContent ? `${messageContent}\n\nArchivos adjuntos: ${mediaInfo}` : `Archivos adjuntos: ${mediaInfo}`;
    }
    pendingMedia.forEach(m => URL.revokeObjectURL(m.url));
    setPendingMedia([]);
    setInput('');
    sendMessage({ text: messageContent });
  };

  const onKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } };

  const sendQuick = (text) => {
    // Dispara el flujo directamente para experiencia tipo sugerencia
    setInput('');
    sendMessage({ text });
  };

  const showHero = messages.length <= 1; // solo mensaje de bienvenida

  return (
    <div className={`min-h-dvh transition-all duration-300 ${dragActive ? 'bg-gradient-to-tr from-sky-50/80 to-white/80 backdrop-blur-md' : 'bg-gradient-to-tr from-sky-50 to-white'} text-gray-900`}>
      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Hero superior eliminado: el saludo vive dentro del chat */}

        <section
          className={`${dragActive ? 'container-card-strong' : 'container-card'} overflow-hidden relative`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={`px-4 sm:px-5 py-3 border-b border-sky-100 transition-all duration-300 ${dragActive ? 'bg-gradient-to-r from-white/60 to-sky-50/60 backdrop-blur-xl' : 'bg-gradient-to-r from-white to-sky-50'} flex items-center gap-3`}>
            <div className="size-9 sm:size-10 rounded-full bg-sky-200 text-sky-900 flex items-center justify-center font-semibold select-none shadow-inner">🤖</div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-sky-900">Roro</p>
              <p className="text-xs small-muted">Especialista en IG/FB · Gemini</p>
            </div>
            <div className="ml-auto"><span className={`text-[11px] sm:text-xs ${isBusy ? 'text-sky-800 bg-sky-200' : 'text-sky-700/80 bg-sky-100'} px-2 py-1 rounded-full`}>{isBusy ? 'Pensando…' : 'En línea'}</span></div>
          </div>

          {/* Lista de mensajes */}
          <div ref={listRef} className={`h-[62vh] sm:h-[68vh] overflow-y-auto px-3 sm:px-6 py-5 space-y-5 transition-all duration-300 ${dragActive ? 'bg-white/40 backdrop-blur-xl' : 'bg-white'}`}>
            {showWelcomeInside && (
              <div className="w-full mx-auto mb-2">
                <div className="mx-auto max-w-2xl text-center">
                  <h1 className="bg-gradient-to-r from-black via-pink-500 to-violet-800 inline-block text-transparent bg-clip-text font-semibold text-3xl sm:text-4xl leading-tight">Hola,</h1><br/>
                  <h2 className="bg-gradient-to-r from-black via-pink-500 to-violet-800 inline-block text-transparent bg-clip-text font-semibold text-3xl sm:text-4xl -mt-2 mb-2 leading-tight">¿en qué te ayudo hoy?</h2>
                  <p className="text-neutral-600 leading-tight tracking-tight mb-4 text-sm sm:text-base">Usa uno de los prompts comunes abajo o escribe el tuyo para empezar.</p>
                </div>
                <div className="flex w-full mb-2 gap-3 text-sm text-neutral-800 flex-col sm:flex-row">
                  {quickPrompts.map((q, idx) => (
                    <button key={idx} type="button" onClick={() => sendQuick(q)} className="group relative grow border border-neutral-200 shadow-sm hover:shadow-md hover:-translate-y-[1px] hover:bg-neutral-100/30 rounded-xl p-4 text-left transition-all duration-300">
                      {q}
                      <svg className="absolute right-2 bottom-2 h-4 text-neutral-500 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g fill="none"><path d="M2 8a.75.75 0 0 1 .75-.75h8.787L8.25 4.309a.75.75 0 0 1 1-1.118L14 7.441a.75.75 0 0 1 0 1.118l-4.75 4.25a.75.75 0 1 1-1-1.118l3.287-2.941H2.75A.75.75 0 0 1 2 8z" fill="currentColor"></path></g></svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const text = Array.isArray(m.parts) ? m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('') : m.content ?? '';
              return <MessageBubble key={m.id} role={m.role} text={text} attachments={[]} dragActive={dragActive} />;
            })}
            {(status === 'submitted' || status === 'streaming') && (
              <MessageBubble role="assistant" text="" typing dragActive={dragActive} />
            )}
          </div>

          {/* Dock de entrada */}
          <div className={`border-t border-sky-100 transition-all duration-300 ${dragActive ? 'bg-white/40 backdrop-blur-xl' : 'bg-white'} p-3 sm:p-4`}
            style={{ boxShadow: '0 -10px 25px -20px rgba(2,132,199,0.25)' }}>
            {pendingMedia.length > 0 && (
              <div className="mb-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pendingMedia.map((m) => (
                  <div key={m.id} className="relative group rounded-lg overflow-hidden border border-sky-100 bg-sky-50">
                    {m.type === 'image' ? (
                      <img src={m.url} alt={m.name} className="h-24 w-full object-cover" />
                    ) : (
                      <video src={m.url} className="h-24 w-full object-cover" muted playsInline />
                    )}
                    <button onClick={() => removePending(m.id)} className="absolute top-1 right-1 inline-flex items-center justify-center size-6 rounded-full bg-white/95 text-sky-900 shadow hover:bg-white" aria-label="Quitar adjunto" type="button">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <label className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-900 shadow-inner shadow-sky-100/50 px-3 py-2 sm:px-3.5 sm:py-2 hover:bg-sky-100 cursor-pointer" title="Adjuntar imagen o video">
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M18.364 5.636a4.5 4.5 0 0 0-6.364 0l-7.071 7.07a4 4 0 1 0 5.657 5.657l1.415-1.414a1 1 0 1 0-1.415-1.415l-1.414 1.415a2 2 0 1 1-2.828-2.829l7.07-7.071a2.5 2.5 0 1 1 3.536 3.536l-3.536 3.536a4.5 4.5 0 0 0 0-6.364Z"/></svg>
              </label>

              <div className="flex-1">
                <div className={`rounded-xl border ${dragActive ? 'border-sky-300 bg-white/70 backdrop-blur' : 'border-sky-200 bg-white'} shadow-inner px-3 py-2`}>
                  <textarea className="w-full resize-none bg-transparent outline-none text-[15px] leading-6 placeholder-sky-800/50" rows={3} placeholder="Escribe tu idea de publicación o pide ayuda para programarla…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[11px] small-muted">Enter para enviar, Shift+Enter para nueva línea</p>
                </div>
              </div>

              <button type="submit" disabled={!canSend} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium shadow-md transition ${canSend ? 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800' : 'bg-sky-200 text-sky-600/70 cursor-not-allowed'}`} aria-label="Enviar">
                <span>Enviar</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M2.293 2.293a1 1 0 0 1 1.055-.242l18 6a1 1 0 0 1 0 1.898l-6.92 2.769a2 2 0 0 0-1.113 1.113l-2.769 6.92a1 1 0 0 1-1.898 0l-6-18a1 1 0 0 1 .645-1.458ZM6.56 7.44l7.517 3.132a.25.25 0 0 1 0 .463L10.94 12.56a2 2 0 0 0-1.152 1.152L9.035 15a.25.25 0 0 1-.463 0L5.44 7.56a.25.25 0 0 1 .463-.463l.657.343Z"/></svg>
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function MessageBubble({ role, text, attachments = [], typing = false, dragActive }) {
  const isAssistant = role === 'assistant';
  return (
    <div className={`flex items-end gap-3 ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`size-8 shrink-0 rounded-full ${isAssistant ? 'bg-sky-200 text-sky-900' : 'bg-sky-600 text-white'} flex items-center justify-center font-semibold select-none shadow-inner`}>{isAssistant ? '🤖' : '👤'}</div>
      {/* Burbuja estilo Flowbite (inspirado) */}
      <div className={`max-w-[88%] sm:max-w-[78%] px-4 py-3 text-[15px] leading-7 shadow border ${isAssistant ? `${dragActive ? 'bg-sky-50/70 border-sky-200/70 backdrop-blur' : 'bg-white border-sky-100'} text-slate-900 rounded-2xl rounded-tl-none` : 'bg-sky-600 border-sky-700/60 text-white rounded-2xl rounded-tr-none'}`}>
        <div className="whitespace-pre-wrap prose-chat">
          {typing ? (
            <TypingDots />
          ) : (
            text
          )}
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {attachments.map((a) => (
              <div key={a.url} className="rounded-lg overflow-hidden border border-sky-100 bg-white">
                {a.type === 'image' ? (
                  <img src={a.url} alt="adjunto" className="h-24 w-full object-cover" />
                ) : (
                  <video src={a.url} className="h-24 w-full object-cover" controls />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="size-1.5 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
      <span className="size-1.5 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDelay: '150ms' }} />
      <span className="size-1.5 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDelay: '300ms' }} />
    </span>
  );
}
