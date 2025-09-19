'use client';

import { useEffect, useRef, useState } from 'react';

export const YouTubeAuthWidget = ({ widgetId, onConnected, onError }) => {
  const [connecting, setConnecting] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    const onMsg = async ev => {
      try {
        if (!ev?.data || ev.origin !== window.location.origin) return;
        if (ev.data?.source !== 'yt-oauth') return;
        if (handledRef.current) return;
        handledRef.current = true;

        if (!ev.data.ok) {
          setConnecting(false);
          onError && onError(ev.data?.reason || 'oauth_error');

          return;
        }

        const d = ev.data.data || {};
        const payload = {
          access_token: d.access_token,
          refresh_token: d.refresh_token || null,
          expires_in: d.expires_in || null,
          channelId: d.channel_id || null,
          channelTitle: d.channel_title || null,
          grantedScopes: d.granted_scopes || null,
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
    if (typeof window !== 'undefined') {
      window.__yt_oauth_handled = false;
    }
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

    window.open(
      '/api/youtube/login',
      'yt_oauth',
      `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
    );
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-3'>
        <div className='relative size-10 shrink-0 rounded-xl bg-[#FF0000] flex items-center justify-center shadow-inner'>
          <svg viewBox='0 0 24 24' className='size-5' aria-hidden='true'>
            <path fill='#fff' d='M10 15.5v-7l6 3.5-6 3.5z' />
            <rect
              x='3'
              y='6'
              width='18'
              height='12'
              rx='3'
              ry='3'
              fill='none'
              stroke='#fff'
              strokeWidth='2'
            />
          </svg>
        </div>
        <div>
          <p className='text-sm font-medium text-gray-800'>YouTube</p>
          <p className='text-xs text-gray-500'>Conectar con OAuth</p>
        </div>
      </div>
      <button
        type='button'
        onClick={startLogin}
        disabled={connecting}
        className='inline-flex items-center gap-2 rounded-lg bg-[#FF0000] px-4 py-2 text-white text-sm disabled:opacity-50 cursor-pointer'
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
        {connecting ? 'Conectando…' : 'Login con YouTube'}
      </button>
    </div>
  );
};

export const YouTubeConnectedWidget = ({
  channelId,
  channelTitle,
  grantedScopes,
  expiresAt,
}) => (
  <div className='flex items-center gap-3'>
    <div className='relative size-10 shrink-0 rounded-xl bg-[#FF0000] flex items-center justify-center shadow-inner'>
      <svg viewBox='0 0 24 24' className='size-5' aria-hidden='true'>
        <path fill='#fff' d='M10 15.5v-7l6 3.5-6 3.5z' />
        <rect
          x='3'
          y='6'
          width='18'
          height='12'
          rx='3'
          ry='3'
          fill='none'
          stroke='#fff'
          strokeWidth='2'
        />
      </svg>
    </div>
    <div>
      <p className='text-sm font-medium text-gray-800'>YouTube conectado</p>
      {channelTitle && (
        <p className='text-xs text-gray-500'>
          {channelTitle} ({channelId})
        </p>
      )}
      {Array.isArray(grantedScopes) && grantedScopes.length > 0 && (
        <p className='text-xs text-gray-400 mt-1'>
          Permisos: {grantedScopes.join(', ')}
        </p>
      )}
      {expiresAt && (
        <p className='text-[11px] text-gray-400 mt-1'>
          Token expira: {new Date(expiresAt).toLocaleString()}
        </p>
      )}
    </div>
  </div>
);
