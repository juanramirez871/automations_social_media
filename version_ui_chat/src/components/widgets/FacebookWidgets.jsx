"use client";

import { useEffect, useState } from "react";

export const FacebookAuthWidget = ({ widgetId, onConnected, onError }) => {
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const onMsg = async (ev) => {
      try {
        if (!ev?.data || ev.data?.source !== 'fb-oauth') return;
        if (ev.origin !== window.location.origin) return;

        if (typeof window !== 'undefined' && window.__fb_oauth_handled) return;
        if (typeof window !== 'undefined') window.__fb_oauth_handled = true;

        if (!ev.data.ok) {
          onError && onError(ev.data.error || 'oauth_error');
          setConnecting(false);
          return;
        }

        const d = ev.data.data || {};
        const payload = {
          access_token: d.access_token,
          expires_in: d.expires_in,
          fb_user: d.fb_user || {},
          granted_scopes: d.granted_scopes || [],
          pageId: d.pageId || null,
          pageName: d.pageName || null,
          userToken: d.userToken || null,
        };
        onConnected && onConnected(payload);
      } catch (err) {
        onError && onError(err?.message || 'unknown_error');
      } finally {
        setConnecting(false);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [widgetId, onConnected, onError]);

  const startLogin = () => {
    setConnecting(true);
    if (typeof window !== 'undefined') window.__fb_oauth_handled = false;
    const w = 600, h = 700;
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = ((width - w) / 2) + dualScreenLeft;
    const top = ((height - h) / 2) + dualScreenTop;
    window.open(
      "/api/facebook/login",
      "fb_oauth",
      `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative size-10 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-inner">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="#fff" d="M13.4 21v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.3-1.3 1.3-1.3h1.5V5c-.3 0-1.1-.1-2.1-.1-2 0-3.4 1.2-3.4 3.5v2H8.4V14h2.3v7h2.7z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">Facebook</p>
          <p className="text-xs text-gray-500">Conectar con OAuth</p>
        </div>
      </div>
      <button
        type="button"
        onClick={startLogin}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-white text-sm disabled:opacity-50"
      >
        {connecting ? (
          <span className="size-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M5 12l5 5L20 7"/></svg>
        )}
        {connecting ? "Conectando…" : "Login con Facebook"}
      </button>
    </div>
  );
};

export const FacebookConnectedWidget = ({ name, fbId, scopes }) => (
  <div className="flex items-center gap-3">
    <div className="relative size-10 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-inner">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#fff" d="M13.4 21v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.3-1.3 1.3-1.3h1.5V5c-.3 0-1.1-.1-2.1-.1-2 0-3.4 1.2-3.4 3.5v2H8.4V14h2.3v7h2.7z"/>
      </svg>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-800">Facebook conectado</p>
      <p className="text-xs text-gray-500">{name ? `${name} (${fbId})` : `ID ${fbId}`}</p>
      {Array.isArray(scopes) && scopes.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">Permisos: {scopes.join(", ")}</p>
      )}
    </div>
  </div>
);