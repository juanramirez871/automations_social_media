"use client";

import { useEffect, useRef, useState } from "react";

export default function Composer({ onSend, loading = false }) {
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState([]); // [{id, url, kind, name, file}]
  const [errors, setErrors] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const accept = "image/*,video/*";

  const handleFiles = (fileList) => {
    // Evitar agregar archivos mientras estamos enviando
    if (loading) return;
    const files = Array.from(fileList || []);
    const newErrors = [];
    const newItems = [];

    files.forEach((f) => {
      const isImage = f.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
      const isVideo = f.type?.startsWith("video/") || /\.(mp4|mov|webm|ogg|mkv|m4v)$/i.test(f.name);
      if (!isImage && !isVideo) {
        newErrors.push(`${f.name}: formato no permitido`);
        return;
      }
      const kind = isVideo ? "video" : "image";
      const url = URL.createObjectURL(f);
      newItems.push({ id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 8)}`, file: f, url, kind, name: f.name });
    });

    if (newItems.length) setPreviews((prev) => [...prev, ...newItems]);
    if (newErrors.length) setErrors((prev) => [...prev, ...newErrors]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dt = e.dataTransfer;
    if (dt?.files?.length) {
      handleFiles(dt.files);
      return;
    }
    if (dt?.items?.length) {
      const asFiles = [];
      for (const item of dt.items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) asFiles.push(f);
        }
      }
      if (asFiles.length) handleFiles(asFiles);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const removePreview = (id) => {
    setPreviews((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  // Nota: no revocamos automáticamente los Object URLs al limpiar todo para evitar cortar los previews en el chat cuando se envían.

  // Global drag & drop: habilita soltar archivos en cualquier zona de la app
  useEffect(() => {
    const handleWindowDragOver = (e) => {
      e.preventDefault();
      setDragActive(true);
    };
    const handleWindowDrop = (e) => {
      e.preventDefault();
      setDragActive(false);
      const dt = e.dataTransfer;
      if (dt?.files?.length) {
        handleFiles(dt.files);
        return;
      }
      if (dt?.items?.length) {
        const asFiles = [];
        for (const item of dt.items) {
          if (item.kind === "file") {
            const f = item.getAsFile();
            if (f) asFiles.push(f);
          }
        }
        if (asFiles.length) handleFiles(asFiles);
      }
    };
    const handleWindowDragLeave = (e) => {
      e.preventDefault();
      setDragActive(false);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
    };
  }, []);

  const handleSend = () => {
    const text = message.trim();
    if (!text && previews.length === 0) return;
    const files = previews.map((p) => p.file);
    onSend?.({ text, files });
    setMessage("");
    setPreviews([]);
    setErrors([]);
  };

  const textareaPadding = previews.length ? "pb-32 sm:pb-32" : "pb-12 sm:pb-12";

  return (
    <div className="max-w-4xl mx-auto sticky bottom-0 z-10 pt-5 pb-4 sm:pt-4 sm:pb-6 px-4 sm:px-6 lg:px-0" aria-busy={loading}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-0">
        <div
          className={`relative ${dragActive ? "ring-2 ring-blue-300 rounded-lg" : ""}`}
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          aria-dropeffect="copy"
        >
          <textarea
            className={`p-3 sm:p-4 ${textareaPadding} block w-full border-gray-200 rounded-lg sm:text-sm focus:border-blue-300 focus:ring-blue-300 disabled:opacity-50 disabled:pointer-events-none`}
            placeholder="Arrastra y suelta imágenes o videos aquí, o haz clic en el clip para seleccionar..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onDrop={onDrop}
            onDragEnter={onDragOver}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            disabled={loading}
          ></textarea>

          <div className="absolute bottom-px inset-x-px p-2 rounded-b-lg bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
            {/* Previews */}
            {previews.length > 0 && (
              <div className="mb-2 overflow-x-auto">
                <div className="flex gap-2">
                  {previews.map((p) => (
                    <div key={p.id} className="relative border border-gray-200 rounded-lg p-1 bg-white overflow-visible">
                      {p.kind === "image" ? (
                        <img src={p.url} alt={p.name} className="h-16 w-16 rounded object-cover" />
                      ) : (
                        <video src={p.url} className="h-16 w-16 rounded object-cover" muted />
                      )}
                      <button
                        type="button"
                        onClick={() => removePreview(p.id)}
                        className="absolute top-1 right-1 z-10 bg-pink-500 text-white rounded-full size-5 flex items-center justify-center text-xs shadow ring-2 ring-white disabled:opacity-50 disabled:pointer-events-none"
                        aria-label={`Eliminar ${p.name}`}
                        disabled={loading}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mb-2 text-xs text-pink-500">
                {errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center">
                <input
                  ref={inputRef}
                  type="file"
                  accept={accept}
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-blue-500 hover:bg-blue-50 focus:z-10 focus:outline-hidden focus:bg-blue-50 disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Adjuntar archivos"
                  disabled={loading}
                >
                  <svg
                    className="shrink-0 size-4"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-x-2">
                <button
                  type="button"
                  onClick={handleSend}
                  className="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-white bg-gradient-to-r from-blue-400 to-pink-400 hover:from-blue-400/90 hover:to-pink-400/90 focus:z-10 focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Enviar mensaje"
                  disabled={loading}
                >
                  <svg
                    className="shrink-0 size-3.5"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}