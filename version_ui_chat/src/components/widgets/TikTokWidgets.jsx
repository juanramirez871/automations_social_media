"use client";

import { useEffect, useRef, useState } from "react";

export const TikTokAuthWidget = ({ widgetId, onConnected, onError }) => {
  const [connecting, setConnecting] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    const onMsg = async (ev) => {
      try {
        if (!ev?.data || ev.origin !== window.location.origin) return;
        if (ev.data?.source !== 'tt-oauth') return;

        // Global guard to prevent multiple instances handling the same message
        if (typeof window !== 'undefined' && window.__tt_oauth_handled) return;

        // Local guard for this component instance
        if (handledRef.current) return;
        handledRef.current = true;
        if (typeof window !== 'undefined') window.__tt_oauth_handled = true;

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
          open_id: d.open_id || null,
          granted_scopes: d.granted_scopes || [],
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
      window.__tt_oauth_handled = false;
    }
    const w = 600, h = 700;
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = ((width - w) / 2) + dualScreenLeft;
    const top = ((height - h) / 2) + dualScreenTop;
    window.open(
      "/api/tiktok/login",
      "tt_oauth",
      `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative size-10 shrink-0 rounded-full bg-black flex items-center justify-center shadow-inner">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="#fff" d="M16.5 7.5c1.1.9 2.4 1.4 3.8 1.5v2.3c-1.6-.1-3.1-.7-4.4-1.7v4.9c0 2.8-2.2 5-5 5s-5-2.2-5-5 2.2-5 5-5c.4 0 .7 0 1 .1v2.4c-.3-.1-.6-.1-1-.1-1.5 0-2.7 1.2-2.7 2.7S9.4 20 11 20s2.7-1.2 2.7-2.7V4h2.8v3.5z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">TikTok</p>
          <p className="text-xs text-gray-500">Conectar con OAuth</p>
        </div>
      </div>
      <button
        type="button"
        onClick={startLogin}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white text-sm disabled:opacity-50"
      >
        {connecting ? (
          <span className="size-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M5 12l5 5L20 7"/></svg>
        )}
        {connecting ? "Conectando…" : "Login con TikTok"}
      </button>
    </div>
  );
};

export const TikTokConnectedWidget = ({ openId, grantedScopes, expiresAt }) => (
  <div className="flex items-center gap-3">
    <div className="relative size-10 shrink-0 rounded-full bg-black flex items-center justify-center shadow-inner">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#fff" d="M16.5 7.5c1.1.9 2.4 1.4 3.8 1.5v2.3c-1.6-.1-3.1-.7-4.4-1.7v4.9c0 2.8-2.2 5-5 5s-5-2.2-5-5 2.2-5 5-5c.4 0 .7 0 1 .1v2.4c-.3-.1-.6-.1-1-.1-1.5 0-2.7 1.2-2.7 2.7S9.4 20 11 20s2.7-1.2 2.7-2.7V4h2.8v3.5z"/>
      </svg>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-800">TikTok conectado</p>
      {openId && <p className="text-xs text-gray-500">OpenID: {openId}</p>}
      {Array.isArray(grantedScopes) && grantedScopes.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">Permisos: {grantedScopes.join(", ")}</p>
      )}
      {expiresAt && (
        <p className="text-[11px] text-gray-400 mt-1">Token expira: {new Date(expiresAt).toLocaleString()}</p>
      )}
    </div>
  </div>
);