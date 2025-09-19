import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const { searchParams, origin } = url;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

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

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const clientId =
      process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
    const clientSecret =
      process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
    let redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!redirectUri) redirectUri = `${origin}/api/instagram/callback`;

    if (!clientId || !clientSecret) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Faltan variables de entorno INSTAGRAM_APP_ID/SECRET o FACEBOOK_APP_ID/SECRET.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: 'Missing INSTAGRAM_APP_ID/SECRET or FACEBOOK_APP_ID/SECRET' }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
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

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Validar estado (CSRF)
    try {
      const cookiesStr = request.headers.get('cookie') || '';
      const cookieMatch = cookiesStr.match(/(?:^|; )ig_oauth_state=([^;]+)/);
      const cookieState = cookieMatch
        ? decodeURIComponent(cookieMatch[1])
        : null;

      console.log('state', state);
      console.log('cookieState', cookieState);
      console.log('state === cookieState', state === cookieState);
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

        return new NextResponse(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    } catch {}

    // Intercambiar code por access_token (Facebook Login OAuth)
    console.log(
      '🔄 Intercambiando code por access_token usando Facebook Graph API...'
    );

    const tokenUrl = new URL(
      'https://graph.facebook.com/v18.0/oauth/access_token'
    );

    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    console.log('📤 URL de intercambio:', tokenUrl.toString());

    const tokenRes2 = await fetch(tokenUrl.toString());
    const tokenJson = await tokenRes2.json();

    if (!tokenRes2.ok || tokenJson.error_type || tokenJson.error_message) {
      const msg =
        tokenJson?.error_message ||
        `Token exchange failed (${tokenRes2.status})`;
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error obteniendo access_token: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const shortLivedToken = tokenJson.access_token;
    const user_id = tokenJson.user_id;
    const expires_in = tokenJson.expires_in || null;

    console.log('🔄 Intercambiando token short-lived por long-lived...');

    // Paso 1: Intercambiar por long-lived token
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `client_secret=${encodeURIComponent(clientSecret)}&` +
        `fb_exchange_token=${encodeURIComponent(shortLivedToken)}`
    );
    const longLivedJson = await longLivedRes.json();

    if (!longLivedRes.ok || longLivedJson.error) {
      console.error('❌ Error intercambiando token:', longLivedJson);
      const msg = longLivedJson?.error?.message || 'Error intercambiando token';
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Error intercambiando token: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const longLivedToken = longLivedJson.access_token;
    const longLivedExpiresIn = longLivedJson.expires_in;

    console.log(
      '✅ Long-lived token obtenido, expira en:',
      longLivedExpiresIn,
      'segundos'
    );

    // Paso 2: Obtener páginas de Facebook
    console.log('📄 Obteniendo páginas de Facebook...');
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(longLivedToken)}`
    );
    const pagesJson = await pagesRes.json();

    if (!pagesRes.ok || pagesJson.error) {
      console.error('❌ Error obteniendo páginas:', pagesJson);
      const msg =
        pagesJson?.error?.message || 'Error obteniendo páginas de Facebook';
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Error obteniendo páginas: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const pages = pagesJson.data || [];

    console.log(
      '📄 Respuesta completa de páginas:',
      JSON.stringify(pagesJson, null, 2)
    );
    console.log('📄 Páginas encontradas:', pages.length);

    if (pages && pages.length > 0) {
      console.log('📄 Detalles de páginas:');
      pages.forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.name} (ID: ${page.id})`);
      });
    }

    if (pages.length === 0) {
      console.log(
        '📄 No se encontraron páginas directas, consultando Business Manager...'
      );

      // Intentar obtener páginas a través de Business Manager
      const businessRes = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?access_token=${encodeURIComponent(longLivedToken)}`
      );
      const businessJson = await businessRes.json();

      console.log(
        '🏢 Respuesta de Business Manager:',
        JSON.stringify(businessJson, null, 2)
      );

      if (businessRes.ok && businessJson.data && businessJson.data.length > 0) {
        const businessId = businessJson.data[0].id;

        console.log('🏢 Usando Business Manager ID:', businessId);

        // Obtener páginas del Business Manager
        const businessPagesRes = await fetch(
          `https://graph.facebook.com/v18.0/${businessId}/owned_pages?access_token=${encodeURIComponent(longLivedToken)}`
        );
        const businessPagesJson = await businessPagesRes.json();

        console.log(
          '📄 Páginas del Business Manager:',
          JSON.stringify(businessPagesJson, null, 2)
        );

        if (
          businessPagesRes.ok &&
          businessPagesJson.data &&
          businessPagesJson.data.length > 0
        ) {
          // Usar las páginas del Business Manager
          pages.push(...businessPagesJson.data);
          console.log(
            '✅ Páginas encontradas en Business Manager:',
            pages.length
          );
        }
      }

      // Si aún no hay páginas después de consultar Business Manager
      if (pages.length === 0) {
        const msg =
          'No se encontraron páginas de Facebook. Necesitas una página conectada a Instagram Business.';
        const html = `<!DOCTYPE html><html><body>
          <p style="font-family: ui-sans-serif, system-ui; color:#111">${msg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
              window.close();
            }
          </script>
        </body></html>`;

        return new NextResponse(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }

    // Usar la primera página (o podrías permitir al usuario elegir)
    const page = pages[0];
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    const pageName = page.name;

    console.log('📄 Usando página:', pageName, 'ID:', pageId);

    // Paso 3: Obtener cuenta de Instagram Business
    console.log('📱 Obteniendo cuenta de Instagram Business...');
    const igAccountRes = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const igAccountJson = await igAccountRes.json();

    if (!igAccountRes.ok || igAccountJson.error) {
      console.error('❌ Error obteniendo cuenta IG:', igAccountJson);
      const msg =
        igAccountJson?.error?.message ||
        'Error obteniendo cuenta de Instagram Business';
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Error obteniendo Instagram Business: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const igBusinessAccount = igAccountJson.instagram_business_account;

    if (!igBusinessAccount) {
      const msg =
        'Esta página de Facebook no tiene una cuenta de Instagram Business conectada.';
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'ig-oauth', ok: false, error: ${JSON.stringify(msg)} }, window.location.origin);
            window.close();
          }
        </script>
      </body></html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const igUserId = igBusinessAccount.id;

    console.log('✅ Instagram Business Account ID:', igUserId);

    // Obtener información del perfil de Instagram
    let igUsername = null;

    try {
      const igProfileRes = await fetch(
        `https://graph.facebook.com/v18.0/${igUserId}?fields=username&access_token=${encodeURIComponent(pageAccessToken)}`
      );
      const igProfileJson = await igProfileRes.json();

      if (igProfileRes.ok && igProfileJson && !igProfileJson.error) {
        igUsername = igProfileJson.username;
      }
    } catch {}

    console.log('✅ Instagram username:', igUsername);

    // Leer widgetId opcional desde cookie para filtrar en el cliente
    const cookiesStr2 = request.headers.get('cookie') || '';
    const widgetMatch = cookiesStr2.match(/(?:^|; )ig_oauth_widget=([^;]+)/);
    const widgetIdFromCookie = widgetMatch
      ? decodeURIComponent(widgetMatch[1])
      : null;

    const payload = {
      source: 'ig-oauth',
      ok: true,
      widgetId: widgetIdFromCookie || undefined,
      data: {
        access_token: pageAccessToken, // Usar PAGE_ACCESS_TOKEN en lugar de user token
        expires_in: longLivedExpiresIn,
        user: {
          id: igUserId, // Usar Instagram Business Account ID
          username: igUsername,
        },
        pageId,
        pageName,
        longLivedToken, // Guardar también el long-lived token del usuario
      },
    };

    const html = `<!DOCTYPE html><html><body>
      <p style="font-family: ui-sans-serif, system-ui; color:#111">Autenticación completada. Puedes cerrar esta ventana.</p>
      <script>
        console.log('🚀 Callback ejecutándose...');
        console.log('📤 Payload a enviar:', ${JSON.stringify(JSON.stringify(payload))});
        
        if (window.opener) {
          console.log('✅ window.opener existe');
          console.log('🌐 Enviando mensaje a origen:', '*');
          
          try {
            window.opener.postMessage(${JSON.stringify(payload)}, '*');
            console.log('✅ Mensaje enviado exitosamente');
          } catch (error) {
            console.error('❌ Error enviando mensaje:', error);
          }
          
          setTimeout(() => {
            console.log('🔒 Cerrando ventana...');
            window.close();
          }, 1000);
        } else {
          console.error('❌ window.opener no existe');
        }
      </script>
    </body></html>`;
    const res = new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    // clear state cookie y widget cookie
    res.cookies.set('ig_oauth_state', '', { path: '/', maxAge: 0 });
    res.cookies.set('ig_oauth_widget', '', { path: '/', maxAge: 0 });

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

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
