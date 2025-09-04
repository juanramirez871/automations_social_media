"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Simple in-memory cache to avoid multiple concurrent/duplicate profile fetches (dev StrictMode safe)
const profileStatusCache = new Map(); // key: userId -> { data }
const profileStatusInflight = new Map(); // key: userId -> Promise<{ data, error }>

async function fetchProfileStatusOnce(userId) {
  if (!userId) return { data: null, error: new Error("missing_user_id") };
  // Serve from cache if present
  if (profileStatusCache.has(userId)) {
    return { data: profileStatusCache.get(userId), error: null };
  }
  // Reuse in-flight promise if exists
  if (profileStatusInflight.has(userId)) {
    try {
      const res = await profileStatusInflight.get(userId);
      return res;
    } catch (e) {
      return { data: null, error: e };
    }
  }
  // Create and store in-flight promise
  const p = (async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('instagram_username, userinstagram, facebook_access_token, facebook_user_id, facebook_granted_scopes, youtube_access_token, youtube_channel_id, youtube_channel_title, tiktok_access_token, tiktok_open_id, tiktok_granted_scopes')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) profileStatusCache.set(userId, data);
    profileStatusInflight.delete(userId);
    return { data, error };
  })();
  profileStatusInflight.set(userId, p);
  try {
    return await p;
  } catch (e) {
    return { data: null, error: e };
  }
}

export const LogoutWidget = ({ onLogout }) => {
  const [working, setWorking] = useState(false);
  const handleLogout = async () => {
    try {
      setWorking(true);
      await onLogout?.();
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <div className="h-1 w-6 rounded-full bg-gradient-to-r from-gray-400 to-gray-300" />
        <p className="text-sm font-medium text-gray-700">Sesión</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={working}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-1.5 text-white text-xs disabled:opacity-50"
      >
        {working ? (
          <span className="size-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M16 13v-2H7V8l-5 4 5 4v-3h9zM20 3h-8a2 2 0 00-2 2v4h2V5h8v14h-8v-4h-2v4a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2z"/></svg>
        )}
        Cerrar sesión
      </button>
    </div>
  );
};

export const ClearChatWidget = ({ onClear }) => {
  const [deleting, setDeleting] = useState(false);
  const handleClear = async () => {
    if (deleting) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm('¿Seguro que deseas borrar todos los mensajes del chat? Esta acción no se puede deshacer.');
      if (!ok) return;
    }
    try {
      setDeleting(true);
      await onClear?.();
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="flex items-center gap-2">
        <div className="h-1 w-6 rounded-full bg-gradient-to-r from-red-400 to-rose-300" />
        <p className="text-sm font-medium text-red-700">Borrar chat</p>
      </div>
      <button
        type="button"
        onClick={handleClear}
        disabled={deleting}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-white text-xs disabled:opacity-50"
      >
        {deleting ? (
          <span className="size-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z"/></svg>
        )}
        Vaciar conversación
      </button>
    </div>
  );
};

export const PlatformsWidget = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({
    instagram: { connected: false, username: null },
    facebook: { connected: false, userId: null, scopes: null },
    youtube: { connected: false, channelId: null, channelTitle: null },
    tiktok: { connected: false, openId: null },
  });

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        // small in-file session cache to avoid repeated getSession calls
        if (!window.__session_cache_once) {
          window.__session_cache_once = (async () => {
            return await supabase.auth.getSession();
          })();
        }
        const { data: sessionData } = await window.__session_cache_once;
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data, error } = await fetchProfileStatusOnce(userId);
        if (error) throw error;

        const instagramUsername = data?.instagram_username || data?.userinstagram || null;
        const hasFB = !!data?.facebook_access_token;
        const fbUserId = data?.facebook_user_id || null;
        const fbScopes = data?.facebook_granted_scopes || null;
        const hasYT = !!data?.youtube_access_token;
        const ytChannelId = data?.youtube_channel_id || null;
        const ytChannelTitle = data?.youtube_channel_title || null;
        const hasTT = !!data?.tiktok_access_token;
        const ttOpenId = data?.tiktok_open_id || null;

        if (!cancelled) {
          setStatus({
            instagram: { connected: !!instagramUsername, username: instagramUsername },
            facebook: { connected: hasFB, userId: fbUserId, scopes: fbScopes },
            youtube: { connected: hasYT, channelId: ytChannelId, channelTitle: ytChannelTitle },
            tiktok: { connected: hasTT, openId: ttOpenId },
          });
        }
      } catch (e) {
        // Silenciar, dejar estados en false
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStatus();
    return () => { cancelled = true; };
  }, []);

  const Badge = ({ ok }) => (
    <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ok ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
      <span className={`size-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-400'}`}></span>
      {ok ? 'Conectado' : 'No conectado'}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-400 to-sky-400" />
        <p className="text-sm font-semibold text-gray-700">Plataformas</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Facebook */}
        <div className="group flex items-center gap-3 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M13.4 21v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.3-1.3 1.3-1.3h1.5V5c-.3 0-1.1-.1-2.1-.1-2 0-3.4 1.2-3.4 3.5v2h-2.3V14h2.3v7h2.7z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              Facebook
              {!loading && <Badge ok={status.facebook.connected} />}
            </p>
            <p className="text-xs text-gray-500 truncate">Páginas y publicaciones</p>
          </div>
        </div>

        {/* Instagram */}
        <div className="group flex items-center gap-3 rounded-xl border border-fuchsia-100 bg-gradient-to-br from-white to-fuchsia-50/30 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-500 flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="#fff" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              Instagram
              {!loading && <Badge ok={status.instagram.connected} />}
            </p>
            <p className="text-xs text-gray-500 truncate">{status.instagram.connected && status.instagram.username ? `@${status.instagram.username}` : 'Feed, Reels y Stories'}</p>
          </div>
        </div>

        {/* YouTube */}
        <div className="group flex items-center gap-3 rounded-xl border border-red-100 bg-gradient-to-br from-white to-red-50/30 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-xl bg-[#FF0000] flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M10 15.5v-7l6 3.5-6 3.5z"/>
              <rect x="3" y="6" width="18" height="12" rx="3" ry="3" fill="none" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              YouTube
              {!loading && <Badge ok={status.youtube.connected} />}
            </p>
            <p className="text-xs text-gray-500 truncate">{status.youtube.connected && status.youtube.channelTitle ? status.youtube.channelTitle : 'Videos y Shorts'}</p>
          </div>
        </div>

        {/* TikTok */}
        <div className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3 hover:shadow-md transition-all">
          <div className="relative size-10 shrink-0 rounded-full bg-black flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path fill="#fff" d="M16.5 7.5c1.1.9 2.4 1.4 3.8 1.5v2.3c-1.6-.1-3.1-.7-4.4-1.7v4.9c0 2.8-2.2 5-5 5s-5-2.2-5-5 2.2-5 5-5c.4 0 .7 0 1 .1v2.4c-.3-.1-.6-.1-1-.1-1.5 0-2.7 1.2-2.7 2.7S9.4 20 11 20s2.7-1.2 2.7-2.7V4h2.8v3.5z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              TikTok
              {!loading && <Badge ok={status.tiktok.connected} />}
            </p>
            <p className="text-xs text-gray-500 truncate">{status.tiktok.connected && status.tiktok.openId ? `OpenID: ${status.tiktok.openId}` : 'Clips y tendencias'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};