'use client';

import { supabase } from './supabaseClient';

// Guardar mensaje en la base de datos
export const saveMessageToDB = async ({
  userId,
  role,
  content = '',
  type,
  attachments,
  meta /* name, messageId */,
}) => {
  if (!userId || !role) return false;
  const baseRow = { user_id: userId, role, content };
  const fullRow = { ...baseRow };
  if (typeof type !== 'undefined') fullRow.type = type;
  if (attachments != null) fullRow.attachments = attachments;
  if (meta != null) fullRow.meta = meta;

  try {
    const { error } = await supabase.from('messages').insert(fullRow);
    if (error) throw error;
    return true;
  } catch (e) {
    const msg = String(e?.message || e || '');
    // Si falla por columnas inexistentes, reintentar con el mínimo
    if (
      /column\s+\w+\s+does\s+not\s+exist/i.test(msg) ||
      /Could not find the '.*' column/i.test(msg)
    ) {
      try {
        const { error } = await supabase.from('messages').insert(baseRow);
        if (error) throw error;
        console.warn(
          'Guardado con payload mínimo por columnas faltantes en messages'
        );
        return true;
      } catch (e2) {
        console.error('Error guardando mensaje (fallback):', e2?.message || e2);
        return false;
      }
    }
    console.error('Error guardando mensaje:', msg);
    return false;
  }
};

// Cargar historial de mensajes para el usuario actual (proveer userId para evitar getSession adicional)
export const loadHistoryForCurrentUser = async userId => {
  try {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Error cargando historial:', e?.message || e);
    return [];
  }
};
