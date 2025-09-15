import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Cliente de Supabase para el servidor con manejo de cookies
export function createServerClient() {
  const cookieStore = cookies();

  return createClient(url, anonKey, {
    auth: {
      getSession: async () => {
        const accessToken = cookieStore.get('sb-access-token')?.value;
        const refreshToken = cookieStore.get('sb-refresh-token')?.value;

        if (!accessToken) {
          return { data: { session: null }, error: null };
        }

        // Crear una sesión mock con el token de las cookies
        return {
          data: {
            session: {
              access_token: accessToken,
              refresh_token: refreshToken,
              user: {
                id: cookieStore.get('sb-user-id')?.value,
                email: cookieStore.get('sb-user-email')?.value,
              },
            },
          },
          error: null,
        };
      },
    },
  });
}

// Cliente alternativo usando headers de autorización
export function createServerClientFromRequest(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createClient(url, anonKey);
  }

  const token = authHeader.substring(7);

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
