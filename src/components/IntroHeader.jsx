'use client';

export default function IntroHeader() {
  return (
    <header className='relative max-w-4xl mx-auto pt-10'>
      {/* Fondos decorativos con blur */}
      <div
        className='pointer-events-none absolute -top-10 -left-10 size-56 rounded-full bg-gradient-to-br from-sky-200 to-blue-200 opacity-60 blur-3xl'
        aria-hidden='true'
      />
      <div
        className='pointer-events-none absolute -bottom-10 -right-10 size-56 rounded-full bg-gradient-to-tr from-blue-200 to-sky-200 opacity-60 blur-3xl'
        aria-hidden='true'
      />

      {/* Tarjeta con efecto glass */}
      <div className='relative overflow-hidden rounded-2xl border border-white/50 bg-white/60 shadow-md backdrop-blur supports-[backdrop-filter]:bg-white/40'>
        <div
          className='absolute inset-0 pointer-events-none bg-gradient-to-r from-sky-100/40 via-transparent to-blue-100/40'
          aria-hidden='true'
        />
        <div className='relative p-6 sm:p-8'>
          {/* Badge superior */}
          <div className='inline-flex items-center gap-2 rounded-full border border-sky-200/60 bg-white/70 px-3 py-1 text-xs text-sky-600 shadow-sm'>
            <span
              className='inline-block size-1.5 rounded-full bg-sky-500 animate-pulse'
              aria-hidden='true'
            />
            <span>Impulsado por IA</span>
          </div>

          {/* Título con degradado */}
          <h1 className='mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight'>
            <span className='bg-clip-text text-transparent bg-gradient-to-r from-sky-500 via-blue-500 to-sky-600'>
              ¡Hola! Bienvenido
            </span>
          </h1>

          {/* Descripción */}
          <p className='mt-3 text-sm sm:text-base text-gray-600'>
            Tu asistente en tus publicaciones
          </p>

          {/* Barra de acento */}
          <div className='mt-5 h-1.5 w-28 rounded-full bg-gradient-to-r from-sky-400 to-blue-400' />

          {/* Chips de características */}
          <div className='mt-5 flex flex-wrap gap-2'>
            <span className='inline-flex items-center rounded-full bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 text-xs'>
              Redes Sociales
            </span>
            <span className='inline-flex items-center rounded-full bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 px-3 py-1 text-xs'>
              IA
            </span>
            <span className='inline-flex items-center rounded-full bg-red-50 text-red-600 border border-red-100 px-3 py-1 text-xs'>
              Calendario
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
