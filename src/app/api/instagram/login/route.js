import { NextResponse } from 'next/server';

function randomState(len = 32) {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';

  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];

  return out;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const widgetId = url.searchParams.get('widgetId') || null;

    const state = randomState();

    // Instagram Business Login (usando Facebook OAuth pero con variables específicas)
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');

    authUrl.searchParams.set(
      'client_id',
      process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID
    );
    authUrl.searchParams.set(
      'redirect_uri',
      process.env.INSTAGRAM_REDIRECT_URI ||
        `${url.origin}/api/instagram/callback`
    );
    authUrl.searchParams.set(
      'scope',
      'instagram_basic,instagram_content_publish,business_management'
    );
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    const res = NextResponse.redirect(authUrl.toString(), { status: 302 });

    res.cookies.set('ig_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    });

    if (widgetId) {
      res.cookies.set('ig_oauth_widget', widgetId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 10 * 60,
      });
    }

    return res;
  } catch (e) {
    const html = `<!DOCTYPE html><html><body>
      <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error iniciando OAuth de Instagram.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(
            String(e?.message || e)
          )} }, window.location.origin);
          window.close();
        }
      </script>
    </body></html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
