import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return htmlClose({ ok: false, reason: error });
    }

    const storedState = request.cookies.get('yt_oauth_state')?.value;

    if (!state || !storedState || state !== storedState) {
      return htmlClose({ ok: false, reason: 'invalid_state' });
    }

    if (!code) {
      return htmlClose({ ok: false, reason: 'missing_code' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return htmlClose({ ok: false, reason: 'missing_env' });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      return htmlClose({ ok: false, reason: 'token_error', data: tokenJson });
    }

    const access_token = tokenJson.access_token;
    const refresh_token = tokenJson.refresh_token || null;
    const expires_in = tokenJson.expires_in || null;
    const expires_at = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Obtener información del canal del usuario autenticado
    let channel_id = null;
    let channel_title = null;

    try {
      const chRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );
      const chJson = await chRes.json();
      const item = chJson?.items?.[0];

      channel_id = item?.id || null;
      channel_title = item?.snippet?.title || null;
    } catch (e) {
      // continuar sin canal
    }

    // Scopes concedidos (si vienen)
    const scopeStr = tokenJson.scope || '';
    const granted_scopes = scopeStr
      ? scopeStr.split(/[\s,]+/).filter(Boolean)
      : [];

    return htmlClose({
      ok: true,
      data: {
        access_token,
        refresh_token,
        expires_at,
        channel_id,
        channel_title,
        granted_scopes,
      },
    });
  } catch (e) {
    return htmlClose({
      ok: false,
      reason: 'exception',
      data: String(e?.message || e),
    });
  }
}

function htmlClose(payload) {
  const body = `<!doctype html>
<html>
  <body>
    <script>
      (function(){
        try {
          var payload = ${JSON.stringify(payload)};
          if (window.opener) {
            window.opener.postMessage({ source: 'yt-oauth', ...payload }, window.location.origin);
          }
        } catch (e) {}
        window.close();
      })();
    </script>
    Cierra esta ventana.
  </body>
</html>`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
