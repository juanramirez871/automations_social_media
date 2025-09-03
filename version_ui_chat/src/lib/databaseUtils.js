"use client";

import { supabase } from "./supabaseClient";

// Guardar mensaje en la base de datos
export const saveMessageToDB = async ({ userId, role, content, name, messageId }) => {
  if (!userId || !content) return false;
  try {
    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      role,
      content,
      name,
      message_id: messageId,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error guardando mensaje:", e?.message || e);
    return false;
  }
};

// Cargar historial de mensajes para el usuario actual
export const loadHistoryForCurrentUser = async () => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Error cargando historial:", e?.message || e);
    return [];
  }
};