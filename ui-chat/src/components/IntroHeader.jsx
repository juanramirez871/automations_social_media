"use client";

export default function IntroHeader() {
  return (
    <header className="relative max-w-4xl mx-auto pt-10">
      {/* Fondos decorativos con blur */}
      <div
        className="pointer-events-none absolute -top-10 -left-10 size-56 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 opacity-60 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-10 -right-10 size-56 rounded-full bg-gradient-to-tr from-pink-200 to-blue-200 opacity-60 blur-3xl"
        aria-hidden="true"
      />

      {/* Tarjeta con efecto glass */}
      <div className="relative overflow-hidden rounded-2xl border border-white/50 bg-white/60 shadow-md backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <div
          className="absolute inset-0 pointer-events-none bg-gradient-to-r from-blue-100/40 via-transparent to-pink-100/40"
          aria-hidden="true"
        />
        <div className="relative p-6 sm:p-8">
          {/* Badge superior */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-white/70 px-3 py-1 text-xs text-blue-600 shadow-sm">
            <span className="inline-block size-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
            <span>Impulsado por IA</span>
          </div>

          {/* Título con degradado */}
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
              ¡Hola! Bienvenido
            </span>
          </h1>

          {/* Descripción */}
          <p className="mt-3 text-sm sm:text-base text-gray-600">Tu asistente en tus publicaciones</p>

          {/* Barra de acento */}
          <div className="mt-5 h-1.5 w-28 rounded-full bg-gradient-to-r from-blue-400 to-pink-400" />

          {/* Chips de características */}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 text-xs">
              <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.2 5.9L20 10l-5.8 2.1L12 18l-2.2-5.9L4 10l5.8-2.1L12 2z"/>
              </svg>
              Gemini
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 text-pink-600 border border-pink-100 px-3 py-1 text-xs">
              <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4 5h16v3H4zM4 10h10v3H4zM4 15h16v3H4z"/>
              </svg>
              Previews multimedia
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-600 border border-purple-100 px-3 py-1 text-xs">
              <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4 12h16M12 4v16"/>
              </svg>
              Scroll suave
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}