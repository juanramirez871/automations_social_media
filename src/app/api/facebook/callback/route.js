import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      const html = `<!DOCTYPE html><html><body>
        <p style="font-family: ui-sans-serif, system-ui; color:#111">Error de autorización de Facebook: ${error}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'fb-oauth', ok: false, error: ${JSON.stringify(
              error
            )} }, '*');
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
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
            window.opener.postMessage({ source: 'fb-oauth', ok: false, error: 'Missing FACEBOOK_APP_ID / FACEBOOK_APP_SECRET' }, '*');
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
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
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Intercambiar code por access_token
    const tokenUrl = new URL(
      "https://graph.facebook.com/v19.0/oauth/access_token"
    );
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok || tokenJson.error) {
      const msg =
        tokenJson?.error?.message ||
        `Token exchange failed (${tokenRes.status})`;
      const html = `<!DOCTYPE html><html><body>
        <p style=\"font-family: ui-sans-serif, system-ui; color:#111\">Error obteniendo access_token: ${msg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ source: 'fb-oauth', ok: false, error: ${JSON.stringify(
              msg
            )} }, '*');
            window.close();
          }
        </script>
      </body></html>`;
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const access_token = tokenJson.access_token;
    const token_type = tokenJson.token_type;
    const expires_in = tokenJson.expires_in;

    console.log('✅ Token de Facebook obtenido, expira en:', expires_in, 'segundos');
    
    // Obtener perfil básico y permisos concedidos
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,picture&access_token=${encodeURIComponent(
        access_token
      )}`
    );
    const meJson = await meRes.json();
    
    console.log('👤 Perfil de Facebook obtenido:', meJson.name, 'ID:', meJson.id);

    const permsRes = await fetch(
      `https://graph.facebook.com/me/permissions?access_token=${encodeURIComponent(
        access_token
      )}`
    );
    const permsJson = await permsRes.json();
    let granted_scopes = null;
    if (Array.isArray(permsJson?.data)) {
      granted_scopes = permsJson.data
        .filter((p) => p.status === "granted")
        .map((p) => p.permission);
    }
    
    console.log('🔑 Permisos concedidos:', granted_scopes);
    
    // Obtener páginas de Facebook administradas
    console.log('📄 Obteniendo páginas de Facebook...');
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(access_token)}`
    );
    const pagesJson = await pagesRes.json();
    
    console.log('📄 Respuesta de páginas:', JSON.stringify(pagesJson, null, 2));
    
    let pageId = null;
    let pageName = null;
    let pageAccessToken = access_token; // Por defecto usar el token del usuario
    
    if (pagesRes.ok && pagesJson.data && pagesJson.data.length > 0) {
      // Usar la primera página encontrada
      const page = pagesJson.data[0];
      pageId = page.id;
      pageName = page.name;
      pageAccessToken = page.access_token || access_token; // Usar PAGE_ACCESS_TOKEN si está disponible
      
      console.log('📄 Usando página:', pageName, 'ID:', pageId);
    } else {
      console.log('⚠️ No se encontraron páginas administradas, usando perfil personal');
      // Si no hay páginas, usar el perfil personal
      pageId = meJson.id;
      pageName = meJson.name;
    }
    
    console.log('📤 Enviando datos al frontend para guardado (igual que Instagram)...');
    console.log('📋 Datos a enviar:', {
      pageId,
      pageName,
      hasToken: !!pageAccessToken,
      tokenLength: pageAccessToken?.length,
      fbUserId: meJson.id,
      fbUserName: meJson.name
    });

    // Responder a la ventana padre para que guarde en DB desde el cliente
    const payload = {
      source: "fb-oauth",
      ok: true,
      data: {
        access_token: pageAccessToken, // Usar PAGE_ACCESS_TOKEN o user token
        token_type,
        expires_in,
        fb_user: meJson,
        granted_scopes,
        pageId: pageId, // ✅ Incluir pageId en data
        pageName: pageName, // ✅ Incluir pageName en data
        userToken: access_token, // Guardar también el token del usuario
      },
    };
    
    console.log('📤 Payload final a enviar:', JSON.stringify(payload, null, 2));
    console.log('🔍 Verificación de datos críticos:');
    console.log('  - pageId en payload:', payload.data.pageId);
    console.log('  - pageName en payload:', payload.data.pageName);
    console.log('  - access_token length:', payload.data.access_token?.length);

    const html = `<!DOCTYPE html><html><body>
      <p style="font-family: ui-sans-serif, system-ui; color:#111">Autenticación completada. Puedes cerrar esta ventana.</p>
      <script>
        console.log('🚀 Callback de Facebook ejecutándose...');
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
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    const html = `<!DOCTYPE html><html><body>
      <p style="font-family: ui-sans-serif, system-ui; color:#111">Error en callback OAuth.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ source: 'fb-oauth', ok: false, error: ${JSON.stringify(
            String(e?.message || e)
          )} }, '*');
          window.close();
        }
      </script>
    </body></html>`;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
