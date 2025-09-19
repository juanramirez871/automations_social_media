'use client';

import { useEffect, useRef, useState } from 'react';

export const InstagramCredentialsWidget = ({ widgetId, onSubmit }) => {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!u || !p || !onSubmit) return;
    setSaving(true);
    try {
      await onSubmit({ username: u, password: p, widgetId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='h-1 w-8 rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-400' />
        <p className='text-sm font-semibold text-gray-700'>
          Conectar Instagram
        </p>
      </div>
      <div className='flex items-center gap-3'>
        <div className='relative size-10 shrink-0 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 flex items-center justify-center shadow-inner'>
          <svg viewBox='0 0 24 24' className='size-5' aria-hidden='true'>
            <path
              fill='#fff'
              d='M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z'
            />
          </svg>
        </div>
        <div>
          <p className='text-sm font-medium text-gray-800'>Instagram</p>
          <p className='text-xs text-gray-500'>Ingresa tus credenciales</p>
        </div>
      </div>
      <form onSubmit={submit} className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <input
          type='text'
          value={u}
          onChange={e => setU(e.target.value)}
          placeholder='Usuario de Instagram'
          className='w-full rounded-lg border border-fuchsia-200 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-fuchsia-300'
        />
        <input
          type='password'
          value={p}
          onChange={e => setP(e.target.value)}
          placeholder='Contraseña de Instagram'
          className='w-full rounded-lg border border-fuchsia-200 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-fuchsia-300'
        />
        <div className='sm:col-span-2'>
          <button
            type='submit'
            disabled={saving || !u || !p}
            className='inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-white text-sm disabled:opacity-50 cursor-pointer'
          >
            {saving ? (
              <span
                className='size-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin'
                aria-hidden='true'
              ></span>
            ) : (
              <svg viewBox='0 0 24 24' className='size-4' aria-hidden='true'>
                <path fill='currentColor' d='M5 12l5 5L20 7' />
              </svg>
            )}
            Guardar y continuar
          </button>
        </div>
      </form>
      <p className='text-xs text-gray-400'>
        Aviso: las credenciales se guardan en tu perfil.
      </p>
    </div>
  );
};

export const InstagramConfiguredWidget = ({ username }) => (
  <div className='flex items-center gap-3'>
    <div className='relative size-10 shrink-0 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 flex items-center justify-center shadow-inner'>
      <svg viewBox='0 0 24 24' className='size-5' aria-hidden='true'>
        <path
          fill='#fff'
          d='M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z'
        />
      </svg>
    </div>
    <div>
      <p className='text-sm font-medium text-gray-800'>Instagram conectado</p>
      <p className='text-xs text-gray-500'>@{username} listo para publicar</p>
    </div>
  </div>
);

// Nuevo: OAuth para Instagram
export const InstagramAuthWidget = ({ widgetId, onConnected, onError }) => {
  const [connecting, setConnecting] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    const onMsg = ev => {
      try {
        if (!ev?.data || ev.origin !== window.location.origin) return;
        if (ev.data?.source !== 'ig-oauth') return;
        // Filtrar por widgetId que inició el flujo: desde callback via cookie o query
        const msgWidgetId = ev.data?.widgetId || null;

        if (widgetId && msgWidgetId && msgWidgetId !== widgetId) return;
        if (handledRef.current) return;
        handledRef.current = true;

        if (!ev.data.ok) {
          setConnecting(false);
          onError && onError(ev.data?.error || 'oauth_error');

          return;
        }

        const d = ev.data.data || {};
        const payload = {
          access_token: d.access_token,
          expires_in: d.expires_in || null,
          user: d.user || {},
        };

        onConnected && onConnected(payload);
      } catch (e) {
        onError && onError(e?.message || 'unknown_error');
      } finally {
        setConnecting(false);
      }
    };

    window.addEventListener('message', onMsg);

    return () => window.removeEventListener('message', onMsg);
  }, [widgetId, onConnected, onError]);

  const startLogin = () => {
    setConnecting(true);
    handledRef.current = false;
    const w = 600,
      h = 700;
    const dualScreenLeft =
      window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop =
      window.screenTop !== undefined ? window.screenTop : window.screenY;
    const width =
      window.innerWidth || document.documentElement.clientWidth || screen.width;
    const height =
      window.innerHeight ||
      document.documentElement.clientHeight ||
      screen.height;
    const left = (width - w) / 2 + dualScreenLeft;
    const top = (height - h) / 2 + dualScreenTop;
    const url = `/api/instagram/login${widgetId ? `?widgetId=${encodeURIComponent(widgetId)}` : ''}`;

    window.open(
      url,
      'ig_oauth',
      `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
    );
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-3'>
        <div className='relative size-10 shrink-0 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 flex items-center justify-center shadow-inner'>
          <svg viewBox='0 0 24 24' className='size-5' aria-hidden='true'>
            <path
              fill='#fff'
              d='M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z'
            />
          </svg>
        </div>
        <div>
          <p className='text-sm font-medium text-gray-800'>Instagram</p>
          <p className='text-xs text-gray-500'>Conectar con OAuth</p>
        </div>
      </div>
      <button
        type='button'
        onClick={startLogin}
        disabled={connecting}
        className='inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-white text-sm disabled:opacity-50 cursor-pointer'
      >
        {connecting ? (
          <span
            className='size-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin'
            aria-hidden='true'
          ></span>
        ) : (
          <svg viewBox='0 0 24 24' className='size-4' aria-hidden='true'>
            <path fill='currentColor' d='M5 12l5 5L20 7' />
          </svg>
        )}
        {connecting ? 'Conectando…' : 'Login con Instagram'}
      </button>
    </div>
  );
};

export const InstagramConnectedWidget = ({ igId, username, expiresAt }) => (
  <div className='flex items-center gap-3'>
    <div className='relative size-10 shrink-0 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-500 flex items-center justify-center shadow-inner'>
      <svg viewBox='0 0 24 24' className='size-5' aria-hidden='true'>
        <path
          fill='#fff'
          d='M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z'
        />
      </svg>
    </div>
    <div>
      <p className='text-sm font-medium text-gray-800'>Instagram conectado</p>
      <p className='text-xs text-gray-500'>
        {username ? `@${username}` : igId ? `ID ${igId}` : 'Cuenta conectada'}
      </p>
      {expiresAt && (
        <p className='text-[11px] text-gray-400 mt-1'>
          Token expira: {new Date(expiresAt).toLocaleString()}
        </p>
      )}
    </div>
  </div>
);
