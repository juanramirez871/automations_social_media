import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Error de autorización de Facebook: ${error}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'fb-oauth', ok: false, error: ${JSON.stringify(error)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    let redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    if (!redirectUri) redirectUri = `${origin}/api/facebook/callback`;

    if (!clientId || !clientSecret) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Faltan variables de entorno FACEBOOK_APP_ID o FACEBOOK_APP_SECRET.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'fb-oauth', ok: false, error: 'Missing FACEBOOK_APP_ID / FACEBOOK_APP_SECRET' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (!code) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Falta el parámetro code.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'fb-oauth', ok: false, error: 'missing_code' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // Intercambiar code por access_token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' });
    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok || tokenJson.error) {
      const msg = tokenJson?.error?.message || `Token exchange failed (${tokenRes.status})`;
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error obteniendo access_token: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'fb-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const access_token = tokenJson.access_token;
    const token_type = tokenJson.token_type;
    const expires_in = tokenJson.expires_in;

    // Obtener perfil básico y permisos concedidos
    const meRes = await fetch(`https://graph.facebook.com/me?fields=id,name,picture&access_token=${encodeURIComponent(access_token)}`);
    const meJson = await meRes.json();

    const permsRes = await fetch(`https://graph.facebook.com/me/permissions?access_token=${encodeURIComponent(access_token)}`);
    const permsJson = await permsRes.json();
    let granted_scopes = null;
    if (Array.isArray(permsJson?.data)) {
      granted_scopes = permsJson.data.filter(p => p.status === 'granted').map(p => p.permission);
    }

    // Responder a la ventana padre para que guarde en DB desde el cliente
    const payload = {
      source: 'fb-oauth',
      ok: true,
      data: {
        access_token,
        token_type,
        expires_in,
        fb_user: meJson,
        granted_scopes,
      }
    };

    const html = `<!DOCTYPE html><html><body>
      <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Autenticación completada. Puedes cerrar esta ventana.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage(${JSON.stringify(payload)}, window.location.origin);
          window.close();
        }
      </script>
    </body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    const html = `<!DOCTYPE html><html><body>
      <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error en callback OAuth.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ source: 'fb-oauth', ok: false, error: ${JSON.stringify(String(e?.message || e))} }, window.location.origin);
          window.close();
        }
      </script>
    </body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}