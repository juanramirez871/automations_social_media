import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    if (error) {
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error de autorización de TikTok: ${error}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'tt-oauth', ok: false, reason: ${JSON.stringify(error)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    let redirectUri = process.env.TIKTOK_REDIRECT_URI;
    if (!redirectUri) redirectUri = `${origin}/api/tiktok/callback`;

    if (!clientKey || !clientSecret) {
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Faltan variables de entorno TIKTOK_CLIENT_KEY o TIKTOK_CLIENT_SECRET.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'tt-oauth', ok: false, reason: 'missing_env' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (!code) {
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Falta el parámetro code.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'tt-oauth', ok: false, reason: 'missing_code' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // Validar state (si existe cookie)
    const cookies = request.cookies;
    const expected = cookies.get?.("tt_oauth_state")?.value || null;
    if (expected && state && expected !== state) {
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">State inválido.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'tt-oauth', ok: false, reason: 'invalid_state' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // Intercambiar code por tokens
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok || tokenJson.error) {
      const msg = tokenJson?.error_description || tokenJson?.message || `Token exchange failed (${tokenRes.status})`;
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error obteniendo tokens de TikTok: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'tt-oauth', ok: false, reason: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const access_token = tokenJson.access_token;
    const refresh_token = tokenJson.refresh_token || null;
    const expires_in = tokenJson.expires_in || null;
    const open_id = tokenJson.open_id || null;
    // TikTok devuelve scope como espacio-separado en algunos casos
    const scope = tokenJson.scope || tokenJson.scopes || null;

    const payload = {
      source: 'tt-oauth',
      ok: true,
      data: {
        access_token,
        refresh_token,
        expires_in,
        open_id,
        granted_scopes: scope ? String(scope).split(/[\s,]+/).filter(Boolean) : [],
      },
    };

    const html = `<!DOCTYPE html><html><body>
      <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Autenticación de TikTok completada. Puedes cerrar esta ventana.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage(${JSON.stringify(payload)}, window.location.origin);
          window.close();
        }
      </script>
    </body></html>`;
    const res = new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    // limpiar cookie state
    try { res.cookies.set("tt_oauth_state", "", { maxAge: 0, path: "/" }); } catch {}
    return res;
  } catch (e) {
    const html = `<!DOCTYPE html><html><body>
      <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error en callback OAuth de TikTok.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ source: 'tt-oauth', ok: false, reason: ${JSON.stringify(String(e?.message || e))} }, window.location.origin);
          window.close();
        }
      </script>
    </body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}