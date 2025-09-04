"use client";

import { supabase } from "./supabaseClient";

// Leer credenciales IG del perfil
export const getInstagramCreds = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("instagram_username, instagram_password, userinstagram, passwordinstagram")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const username = data?.instagram_username || data?.userinstagram || null;
    const password = data?.instagram_password || data?.passwordinstagram || null;
    return { username, password };
  } catch (e) {
    console.warn("No se pudieron obtener credenciales IG:", e?.message || e);
    return { username: null, password: null };
  }
};

// Guardar/actualizar credenciales IG en perfil (upsert por id)
export const upsertInstagramCreds = async ({ userId, username, password }) => {
  const row = {
    id: userId,
    instagram_username: username,
    instagram_password: password,
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch (e1) {
    // Fallback: columnas alternativas
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            userinstagram: username,
            passwordinstagram: password,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      if (error) throw error;
      return true;
    } catch (e2) {
      console.error("Error guardando credenciales IG:", e2?.message || e2);
      return false;
    }
  }
};

// Leer token de Facebook del perfil
export const getFacebookToken = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("facebook_access_token, facebook_expires_at, facebook_user_id, facebook_granted_scopes")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const token = data?.facebook_access_token || null;
    const expiresAt = data?.facebook_expires_at || null;
    const fbUserId = data?.facebook_user_id || null;
    const grantedScopes = data?.facebook_granted_scopes || null;
    return { token, expiresAt, fbUserId, grantedScopes };
  } catch (e) {
    console.warn("No se pudo obtener token de Facebook:", e?.message || e);
    return { token: null, expiresAt: null, fbUserId: null, grantedScopes: null };
  }
};

// Guardar/actualizar token de Facebook en perfil
export const upsertFacebookToken = async ({ userId, token, expiresAt = null, fbUserId = null, grantedScopes = null, fbName = null }) => {
  try {
    const row = {
      id: userId,
      facebook_access_token: token,
      facebook_expires_at: expiresAt,
      facebook_user_id: fbUserId,
      facebook_granted_scopes: grantedScopes,
      facebook_user_name: fbName,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error guardando token de Facebook:", e?.message || e);
    return false;
  }
};

// Leer token de YouTube del perfil
export const getYouTubeToken = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("youtube_access_token, youtube_refresh_token, youtube_expires_at, youtube_channel_id, youtube_channel_title, youtube_granted_scopes")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const token = data?.youtube_access_token || null;
    const refreshToken = data?.youtube_refresh_token || null;
    const expiresAt = data?.youtube_expires_at || null;
    const channelId = data?.youtube_channel_id || null;
    const channelTitle = data?.youtube_channel_title || null;
    const grantedScopes = data?.youtube_granted_scopes || null;
    return { token, refreshToken, expiresAt, channelId, channelTitle, grantedScopes };
  } catch (e) {
    console.warn("No se pudo obtener token de YouTube:", e?.message || e);
    return { token: null, refreshToken: null, expiresAt: null, channelId: null, channelTitle: null, grantedScopes: null };
  }
};

// Guardar/actualizar token de YouTube en perfil
export const upsertYouTubeToken = async ({ userId, token, refreshToken = null, expiresAt = null, channelId = null, channelTitle = null, grantedScopes = null }) => {
  try {
    const row = {
      id: userId,
      youtube_access_token: token,
      youtube_refresh_token: refreshToken,
      youtube_expires_at: expiresAt,
      youtube_channel_id: channelId,
      youtube_channel_title: channelTitle,
      youtube_granted_scopes: grantedScopes,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error guardando token de YouTube:", e?.message || e);
    return false;
  }
};

// Leer token de TikTok del perfil
export const getTikTokToken = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("tiktok_access_token, tiktok_refresh_token, tiktok_expires_at, tiktok_open_id, tiktok_granted_scopes")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const token = data?.tiktok_access_token || null;
    const refreshToken = data?.tiktok_refresh_token || null;
    const expiresAt = data?.tiktok_expires_at || null;
    const openId = data?.tiktok_open_id || null;
    const grantedScopes = data?.tiktok_granted_scopes || null;
    return { token, refreshToken, expiresAt, openId, grantedScopes };
  } catch (e) {
    console.warn("No se pudo obtener token de TikTok:", e?.message || e);
    return { token: null, refreshToken: null, expiresAt: null, openId: null, grantedScopes: null };
  }
};

// Guardar/actualizar token de TikTok en perfil
export const upsertTikTokToken = async ({ userId, token, refreshToken = null, expiresAt = null, openId = null, grantedScopes = null }) => {
  try {
    const row = {
      id: userId,
      tiktok_access_token: token,
      tiktok_refresh_token: refreshToken,
      tiktok_expires_at: expiresAt,
      tiktok_open_id: openId,
      tiktok_granted_scopes: grantedScopes,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error guardando token de TikTok:", e?.message || e);
    return false;
  }
};