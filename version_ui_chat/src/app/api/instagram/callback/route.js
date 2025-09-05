import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const { searchParams, origin } = url;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    if (error) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Error de autorización de Instagram: ${error}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(error)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const clientId = process.env.INSTAGRAM_APP_ID;
    const clientSecret = process.env.INSTAGRAM_APP_SECRET;
    let redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    if (!redirectUri) redirectUri = `${origin}/api/instagram/callback`;

    if (!clientId || !clientSecret) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Faltan variables de entorno INSTAGRAM_APP_ID o INSTAGRAM_APP_SECRET.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: 'Missing INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET' }, window.location.origin);
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
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: 'missing_code' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // Validar estado (CSRF)
    try {
      const cookiesStr = request.headers.get("cookie") || "";
      const cookieMatch = cookiesStr.match(/(?:^|; )ig_oauth_state=([^;]+)/);
      const cookieState = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
      console.log('state', state)
      console.log('cookieState', cookieState)
      console.log('state === cookieState', state === cookieState)
      if (!state || !cookieState || state !== cookieState) {
        const html = `<!DOCTYPE html><html><body>
          <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Estado inválido. Intenta nuevamente.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ source: 'ig-oauth', ok: false, error: 'invalid_state' }, window.location.origin);
              window.close();
            }
          </script>
        </body></html>`;
        return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    } catch {}

    // Intercambiar code por access_token (Instagram Basic Display OAuth)
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error_type || tokenJson.error_message) {
      const msg = tokenJson?.error_message || `Token exchange failed (${tokenRes.status})`;
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error obteniendo access_token: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const access_token = tokenJson.access_token;
    const user_id = tokenJson.user_id;
    const expires_in = tokenJson.expires_in || null;

    // Obtener perfil básico
    let user = null;
    try {
      const meRes = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(access_token)}`
      );
      const meJson = await meRes.json();
      if (meRes.ok && meJson && !meJson.error) {
        user = { id: meJson.id, username: meJson.username };
      }
    } catch {}

    // Leer widgetId opcional desde cookie para filtrar en el cliente
    const cookiesStr2 = request.headers.get("cookie") || "";
    const widgetMatch = cookiesStr2.match(/(?:^|; )ig_oauth_widget=([^;]+)/);
    const widgetIdFromCookie = widgetMatch ? decodeURIComponent(widgetMatch[1]) : null;

    const payload = {
      source: "ig-oauth",
      ok: true,
      widgetId: widgetIdFromCookie || undefined,
      data: {
        access_token,
        expires_in,
        user: user || { id: user_id || null },
      },
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
    const res = new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    // clear state cookie y widget cookie
    res.cookies.set("ig_oauth_state", "", { path: "/", maxAge: 0 });
    res.cookies.set("ig_oauth_widget", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    const html = `<!DOCTYPE html><html><body>
      <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error en callback OAuth.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(String(e?.message || e))} }, window.location.origin);
          window.close();
        }
      </script>
    </body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}