// Supabase Utilities

/**
 * Crea un cliente de Supabase para el servidor
 */
export async function createSupabaseClient() {
  console.log('🔧 Creando cliente Supabase para servidor...');
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variables de Supabase no configuradas');
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Cliente Supabase creado correctamente');
  
  return supabase;
}

/**
 * Valida que el userId esté presente
 */
export function validateUserId(userId) {
  if (!userId) {
    throw new Error('Usuario no especificado');
  }
  return true;
}