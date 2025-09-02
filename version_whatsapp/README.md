# Automations Social Media

Automatiza la publicación de contenido en Facebook, Instagram y X (Twitter) a partir de mensajes recibidos por WhatsApp. El sistema usa OpenAI para decidir plataformas, generar captions y hashtags, y publica en las redes seleccionadas. Soporta dos proveedores de WhatsApp (Cloud API y Baileys), dos de Instagram (Graph API y Web no oficial), Facebook vía SDK `fb`, y X vía `twitter-api-sdk`.

## Objetivo
- Convertir mensajes de WhatsApp (texto + imagen/video opcional) en publicaciones listas para Facebook, Instagram y X.
- Reducir fricción: escribe tu idea por WhatsApp, el sistema crea el plan, aloja el media, publica y te devuelve los resultados (links/ids) por el mismo WhatsApp.

## Flujo (de extremo a extremo)
1. Usuario envía un mensaje por WhatsApp (texto y, opcionalmente, imagen o video).
2. Webhook (provider=cloud) o cliente Baileys (provider=baileys) recibe el evento y lo pasa al orquestador.
3. Orquestador:
   - Detecta la intención y el tipo de media.
   - Llama a OpenAI para planificar: plataformas sugeridas, caption y hashtags.
   - Sube el media (buffer o URL pública) a Cloudinary para obtener una URL estable.
   - Publica en cada plataforma seleccionada mediante sus adaptadores:
     - Facebook: `fb` SDK (photos/videos/feed).
     - Instagram: `graph` (Business) o `web` (no oficial, sólo fotos) con `instagram-web-api`.
     - X (Twitter): `twitter-api-sdk` (createTweet de texto).
   - Devuelve un resumen por WhatsApp con el estado de cada publicación.

## Estructura del proyecto
- src/server.js: servidor Express, healthcheck, webhooks, endpoints auxiliares.
- src/orchestrator.js: lógica principal de orquestación.
- src/openai.js: generación de plan (plataformas, caption, hashtags).
- src/media_store.js: subida de binarios/URLs a Cloudinary.
- src/platforms/
  - facebook.js: publicación con SDK `fb`.
  - instagram.js: publicación Graph API o `instagram-web-api` (web provider) y lectura de posts (web).
  - x.js: publicación de tweets con `twitter-api-sdk`.
- src/whatsapp_router.js: webhook Cloud API (verify + receive).
- src/whatsapp_baileys.js: cliente Baileys (QR, reconexión, eventos).
- src/whatsapp_client.js: envío de mensajes de WhatsApp (Cloud o Baileys) y utilidades de media.
- src/config.js: lectura de variables de entorno.

## Proveedores y capacidades
- WhatsApp
  - cloud: Webhook oficial (Meta). Requiere `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`.
  - baileys: No oficial (requiere escanear QR en consola). Sin webhook.
- Instagram
  - graph: Oficial (Business). Soporta foto y video.
  - web: No oficial (`instagram-web-api`). Requiere `INSTAGRAM_USERNAME` y `INSTAGRAM_PASSWORD`. Sólo fotos (uploadPhoto).
- Facebook
  - SDK `fb` con `META_ACCESS_TOKEN`. Soporta feed (texto), photos (url), videos (file_url).
- X (Twitter)
  - `twitter-api-sdk` con `X_BEARER_TOKEN`. Publica tweets de texto.

## Requisitos
- Node.js 18+
- Cuenta/s y credenciales según cada proveedor que actives.

## Configuración (.env)
Copia `.env.example` a `.env` y rellena valores:

- Server
  - PORT, NODE_ENV, LOG_LEVEL
- WhatsApp
  - WHATSAPP_PROVIDER=cloud | baileys
  - Para cloud: WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_ACCESS_TOKEN
- OpenAI
  - OPENAI_API_KEY (opcional: si no está, usa un plan básico por defecto)
- Instagram
  - INSTAGRAM_PROVIDER=graph | web
  - graph: INSTAGRAM_BUSINESS_ACCOUNT_ID, META_ACCESS_TOKEN
  - web: INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, INSTAGRAM_COOKIE_FILE
- Facebook
  - FACEBOOK_PAGE_ID, META_ACCESS_TOKEN
- X (Twitter)
  - X_BEARER_TOKEN (recomendado con permisos tweet.write)
- Cloudinary
  - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

## Ejecutar en local
```bash
npm install
npm run dev
```
- provider=baileys: en consola aparecerá un QR para escanear con la app de WhatsApp.
- provider=cloud: expone el webhook `/webhook/whatsapp` (GET verify, POST receive). Deberás configurarlo en Meta.

## Endpoints
- GET `/health`: healthcheck.
- WhatsApp (sólo provider=cloud):
  - GET `/webhook/whatsapp` (verify)
  - POST `/webhook/whatsapp` (receive)
- Instagram (sólo provider=web):
  - GET `/instagram/:username/posts?first=12` – Lista posts recientes de un usuario (lectura pública desde web).

## Notas importantes
- Baileys (no oficial): riesgo de bloqueo de cuenta. Úsalo bajo tu responsabilidad.
- Instagram Web: puede requerir “challenge”. Persistimos sesión en `INSTAGRAM_COOKIE_FILE`.
- X (Twitter): con Bearer Token puedes crear tweets de texto en contexto de app. Para user-context (OAuth 2.0 PKCE) se puede extender.
- Cloudinary: sólo alojamos media para facilitar publicación cross-platform.