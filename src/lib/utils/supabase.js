export async function createSupabaseClient() {
  const { createClient } = await import('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variables de Supabase no configuradas');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  return supabase;
}

export function validateUserId(userId) {
  if (!userId) {
    throw new Error('Usuario no especificado');
  }
  return true;
}
