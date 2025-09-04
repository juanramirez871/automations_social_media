import { NextResponse } from "next/server";

function randomState(len = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET(request) {
  try {
    const { origin } = new URL(request.url);

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET; // validar presencia
    let redirectUri = process.env.TIKTOK_REDIRECT_URI;
    if (!redirectUri) redirectUri = `${origin}/api/tiktok/callback`;

    if (!clientKey || !clientSecret) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Faltan variables de entorno TIKTOK_CLIENT_KEY o TIKTOK_CLIENT_SECRET.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'tt-oauth', ok: false, reason: 'missing_env' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const scopes = ["user.info.basic", "video.upload", "video.publish"];
    const state = randomState();
    const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");

    authorizeUrl.searchParams.set("client_key", clientKey);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", scopes);
    authorizeUrl.searchParams.set("state", state);
    console.log(authorizeUrl.toString())

    const res = NextResponse.redirect(authorizeUrl.toString(), { status: 302 });
    res.cookies.set("tt_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    return res;
  } catch (e) {
    const html = `<!DOCTYPE html><html><body>
      <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error iniciando OAuth de TikTok.</p>
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