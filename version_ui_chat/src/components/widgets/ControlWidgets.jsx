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
      .select('instagram_username, facebook_access_token, facebook_user_id, facebook_granted_scopes, youtube_access_token, youtube_channel_id, youtube_channel_title, tiktok_access_token, tiktok_open_id, tiktok_granted_scopes')
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

        const instagramUsername = data?.instagram_username  || null;
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

export const PostPublishWidget = ({ onContinue, defaultSelected = [], onChangeTargets }) => {
  const makeInitialTargets = (arr) => {
    const base = { instagram: false, facebook: false, youtube: false, tiktok: false };
    if (Array.isArray(arr)) {
      for (const k of arr) {
        if (k in base) base[k] = true;
      }
    }
    return base;
  };

  const [targets, setTargets] = useState(() => makeInitialTargets(defaultSelected));

  useEffect(() => {
    // Sincronizar cuando cambie la selección por defecto (por ejemplo, tras recargar)
    setTargets(makeInitialTargets(defaultSelected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(defaultSelected) ? defaultSelected.join('|') : '']);

  const toggle = (k) =>
    setTargets((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      if (typeof onChangeTargets === 'function') {
        const arr = ['instagram', 'facebook', 'youtube', 'tiktok'].filter((p) => next[p]);
        try { onChangeTargets(arr); } catch {}
      }
      return next;
    });

  const chip = (k, label, color) => (
    <button
      type="button"
      onClick={() => toggle(k)}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${targets[k] ? `${color.activeBg} ${color.activeText} ${color.activeBorder}` : `${color.inactiveBg} ${color.inactiveText} ${color.inactiveBorder}`}`}
    >
      <span className={`size-1.5 rounded-full ${targets[k] ? color.dotActive : color.dotInactive}`}></span>
      {label}
    </button>
  );

  const selected = ['instagram','facebook','youtube','tiktok'].filter(k => targets[k]);
  const canContinue = selected.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" />
        <p className="text-sm font-semibold text-gray-800">¿Dónde quieres publicar?</p>
      </div>
      <p className="text-xs text-gray-600">Selecciona una o varias plataformas para continuar.</p>
      <div className="flex flex-wrap gap-2">
        {chip('instagram', 'Instagram', {
          activeBg: 'bg-fuchsia-50', activeText: 'text-fuchsia-700', activeBorder: 'border-fuchsia-200', dotActive: 'bg-fuchsia-500',
          inactiveBg: 'bg-white', inactiveText: 'text-gray-700', inactiveBorder: 'border-gray-200', dotInactive: 'bg-gray-300',
        })}
        {chip('facebook', 'Facebook', {
          activeBg: 'bg-blue-50', activeText: 'text-blue-700', activeBorder: 'border-blue-200', dotActive: 'bg-blue-500',
          inactiveBg: 'bg-white', inactiveText: 'text-gray-700', inactiveBorder: 'border-gray-200', dotInactive: 'bg-gray-300',
        })}
        {chip('youtube', 'YouTube', {
          activeBg: 'bg-red-50', activeText: 'text-red-700', activeBorder: 'border-red-200', dotActive: 'bg-red-500',
          inactiveBg: 'bg-white', inactiveText: 'text-gray-700', inactiveBorder: 'border-gray-200', dotInactive: 'bg-gray-300',
        })}
        {chip('tiktok', 'TikTok', {
          activeBg: 'bg-gray-50', activeText: 'text-gray-900', activeBorder: 'border-gray-300', dotActive: 'bg-gray-900',
          inactiveBg: 'bg-white', inactiveText: 'text-gray-700', inactiveBorder: 'border-gray-200', dotInactive: 'bg-gray-300',
        })}
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-[11px] text-gray-500">Selección: {selected.join(', ') || 'ninguna'}</span>
        <button
          type="button"
          onClick={() => canContinue && typeof onContinue === 'function' && onContinue(selected)}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-60"
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

export const CaptionSuggestWidget = ({ caption = '', onAccept, onRegenerate, onCustom }) => {
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null); // 'regenerate' | 'custom' | 'accept' | null

  const handle = async (kind, fn, arg) => {
    if (typeof fn !== 'function') return;
    try {
      setBusy(true);
      setActive(kind);
      await fn(arg);
    } finally {
      setBusy(false);
      setActive(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
        <p className="text-sm font-semibold text-gray-800">Descripción sugerida</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
        {caption || '—'}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => handle('regenerate', onRegenerate)}
          disabled={busy}
          aria-busy={busy && active === 'regenerate'}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-800 transition-all duration-200 ease-out hover:bg-gray-200 hover:-translate-y-0.5 hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {active === 'regenerate' ? (
            <span className="size-3.5 rounded-full border-2 border-gray-700/40 border-t-transparent animate-spin" aria-hidden="true"></span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M12 6v3l4-4-4-4v3C7.6 4 4 7.6 4 12c0 1.7.6 3.3 1.6 4.6l1.5-1.3C6.4 14.5 6 13.3 6 12c0-3.3 2.7-6 6-6zm6.4-.6L16.9 6.7C17.6 7.5 18 8.7 18 10c0 3.3-2.7 6-6 6v-3l-4 4 4 4v-3c4.4 0 8-3.6 8-8 0-1.7-.6-3.3-1.6-4.6z"/></svg>
          )}
          Regenerar
        </button>
        <button
          type="button"
          onClick={() => handle('custom', onCustom)}
          disabled={busy}
          aria-busy={busy && active === 'custom'}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs text-amber-900 transition-all duration-200 ease-out hover:bg-amber-200 hover:-translate-y-0.5 hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {active === 'custom' ? (
            <span className="size-3.5 rounded-full border-2 border-amber-900/40 border-t-transparent animate-spin" aria-hidden="true"></span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M3 6a3 3 0 013-3h7l5 5v10a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm12 0H6a1 1 0 00-1 1v10c0 .6.4 1 1 1h10a1 1 0 001-1V9h-2a1 1 0 01-1-1V6z"/></svg>
          )}
          Escribir la mía
        </button>
        <button
          type="button"
          onClick={() => handle('accept', onAccept, caption)}
          disabled={busy}
          aria-busy={busy && active === 'accept'}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white transition-all duration-200 ease-out hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {active === 'accept' ? (
            <span className="size-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M5 12l5 5L20 7"/></svg>
          )}
          Usar esta
        </button>
      </div>
    </div>
  );
};

export const ScheduleWidget = ({ defaultValue = null, onConfirm, publishData = null }) => {
  const [busy, setBusy] = useState(false);
  const [publishStatus, setPublishStatus] = useState(null); // 'publishing' | 'success' | 'error'
  const [publishError, setPublishError] = useState(null);
  const [value, setValue] = useState(() => {
    if (defaultValue) return defaultValue;
    // Default: next full half-hour in local time
    const now = new Date();
    now.setMinutes(now.getMinutes() + (30 - (now.getMinutes() % 30 || 30)));
    now.setSeconds(0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return local;
  });

  const minValue = (() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  })();

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  const handleConfirm = async () => {
    if (!onConfirm || typeof onConfirm !== 'function') return;
    if (!value) return;
    
    try {
      setBusy(true);
      setPublishStatus('publishing');
      setPublishError(null);
      
      // Si hay datos de publicación, publicar inmediatamente
      if (publishData) {
        console.log('🚀 Iniciando publicación con datos:', publishData);
        
        // Obtener userId de la sesión actual
        console.log('📋 Obteniendo sesión de usuario...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('👤 Sesión obtenida:', session?.user?.id ? 'Usuario válido' : 'Sin usuario');
        
        if (!session?.user?.id) {
          throw new Error('No hay sesión de usuario válida');
        }
        
        const requestBody = {
          caption: publishData.caption || '',
          imageUrl: publishData.imageUrl || null,
          videoUrl: publishData.videoUrl || null,
          platforms: publishData.platforms || ['instagram'],
          userId: session.user.id,
        };
        
        console.log('📤 Enviando petición a /api/publish con:', requestBody);
        
        const response = await fetch('/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log('📥 Respuesta recibida. Status:', response.status, 'OK:', response.ok);
        
        const result = await response.json();
        console.log('📋 Resultado parseado:', result);
        
        if (!response.ok || !result.success) {
          console.error('❌ Error en publicación:', result);
          console.log('📄 Response completa:', response);
          throw new Error(result.error || result.message || 'Error en la publicación');
        }
        
        console.log('✅ Publicación exitosa!');
        
        setPublishStatus('success');
        // Llamar onConfirm con el resultado de la publicación
        await onConfirm({ scheduledDate: value, publishResult: result });
      } else {
        // Solo programar sin publicar
        await onConfirm(value);
      }
    } catch (error) {
      console.error('Error en publicación:', error);
      setPublishStatus('error');
      setPublishError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-violet-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-violet-400 to-purple-400" />
        <p className="text-sm font-semibold text-gray-800">Programar publicación</p>
      </div>
      <div className="text-xs text-gray-600">
        {publishData ? 'Elige cuándo publicar el contenido' : 'Elige la fecha y hora para programar el post'}. Zona horaria: <span className="font-medium">{tz}</span>.
      </div>
      
      {publishStatus === 'publishing' && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="size-4 rounded-full border-2 border-blue-500/60 border-t-transparent animate-spin" aria-hidden="true"></span>
          <span className="text-sm text-blue-700">
            Publicando en {publishData?.platforms?.length > 1 
              ? publishData.platforms.join(', ').replace(/,([^,]*)$/, ' y$1')
              : publishData?.platforms?.[0] || 'redes sociales'
            }...
          </span>
        </div>
      )}
      
      {publishStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <svg viewBox="0 0 24 24" className="size-4 text-green-600" aria-hidden="true">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span className="text-sm text-green-700">
            ¡Publicado exitosamente en {publishData?.platforms?.length > 1 
              ? publishData.platforms.join(', ').replace(/,([^,]*)$/, ' y$1')
              : publishData?.platforms?.[0] || 'redes sociales'
            }!
          </span>
        </div>
      )}
      
      {publishStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <svg viewBox="0 0 24 24" className="size-4 text-red-600" aria-hidden="true">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span className="text-sm text-red-700">Error: {publishError}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          min={minValue}
          className="block w-full max-w-[280px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-300"
        />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || !value}
          aria-busy={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs text-white transition-all duration-200 ease-out hover:bg-violet-700 hover:-translate-y-0.5 hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? (
            <span className="size-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" aria-hidden="true"></span>
          ) : publishData ? (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M7 10h5v5H7z"/><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 00-2 2v13a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 15H5V8h14v10z"/></svg>
          )}
          {publishData ? 'Publicar ahora' : 'Programar'}
        </button>
      </div>
    </div>
  );
};