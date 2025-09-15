import { supabase } from "@/lib/supabaseClient";

// Session cache (module-scope) to avoid duplicate supabase.auth.getSession() calls
let __sessionCache = null;
let __sessionInflight = null;

export async function getSessionOnce() {
  if (__sessionCache) return { data: __sessionCache };
  if (__sessionInflight) return await __sessionInflight;
  __sessionInflight = (async () => {
    const res = await supabase.auth.getSession();
    __sessionCache = res?.data || null;
    __sessionInflight = null;
    return { data: __sessionCache };
  })();
  return await __sessionInflight;
}

export function clearSessionCache() {
  __sessionCache = null;
  __sessionInflight = null;
}