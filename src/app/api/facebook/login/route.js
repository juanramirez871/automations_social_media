import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);

    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET; // just to validate presence here
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

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const scopeParam =
      'public_profile,email,pages_manage_posts,pages_read_engagement';
    const state = Math.random().toString(36).slice(2);

    const fbAuthUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');

    fbAuthUrl.searchParams.set('client_id', clientId);
    fbAuthUrl.searchParams.set('redirect_uri', redirectUri);
    fbAuthUrl.searchParams.set('response_type', 'code');
    fbAuthUrl.searchParams.set('scope', scopeParam);
    fbAuthUrl.searchParams.set('state', state);

    return NextResponse.redirect(fbAuthUrl.toString(), { status: 302 });
  } catch (e) {
    const html = `<!DOCTYPE html><html><body>
      <p style="font-family: ui-sans-serif, system-ui; color:#111">Error iniciando OAuth de Facebook.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ source: 'fb-oauth', ok: false, error: ${JSON.stringify(String(e?.message || e))} }, window.location.origin);
          window.close();
        }
      </script>
    </body></html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
