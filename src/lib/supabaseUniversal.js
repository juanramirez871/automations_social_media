import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Cliente universal que funciona tanto en servidor como cliente
export function createUniversalClient() {
  // Verificar si estamos en el servidor
  const isServer = typeof window === 'undefined';
  
  if (isServer) {
    // En el servidor, usar el service role key si está disponible
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (serviceRoleKey) {
      return createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  }
  
  // Cliente estándar para navegador o servidor sin service role
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  });
}

// Cliente singleton para evitar múltiples instancias
let supabaseInstance = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createUniversalClient();
  }
  return supabaseInstance;
}

// Exportar también como default
export default getSupabaseClient;