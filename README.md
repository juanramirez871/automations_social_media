# Chat IA con Efecto Vidrio

Un chat moderno con integración de Google Gemini AI y efectos visuales de vidrio cuando se arrastra contenido.

## Características

✨ **Efecto Vidrio**: Cuando arrastras archivos sobre el chat, toda la interfaz se transforma con un hermoso efecto de vidrio (`backdrop-blur-xl`)

🤖 **IA Integrada**: Powered by Google Gemini usando AI SDK Vercel 5

📎 **Drag & Drop**: Arrastra imágenes y videos directamente al chat

🎨 **Diseño Moderno**: Interfaz limpia con Tailwind CSS y efectos de transición suaves

## Configuración

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar API Key de Google Gemini

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crea una nueva API key
3. Copia la API key
4. Edita el archivo `.env.local` y reemplaza `your_google_api_key_here` con tu API key:

```env
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key_aqui
```

### 3. Ejecutar el proyecto
```bash
npm run dev
```

El chat estará disponible en `http://localhost:3000` (o el puerto que Next.js asigne automáticamente).

## Uso

### Efecto Vidrio
- Arrastra cualquier archivo sobre la ventana del chat
- Observa cómo toda la interfaz se transforma con efectos de vidrio
- Los elementos se vuelven semi-transparentes con `backdrop-blur-xl`
- Las transiciones son suaves gracias a `transition-all duration-300`

### Chat con IA
- Escribe mensajes y recibe respuestas de Google Gemini
- Adjunta imágenes y videos (hasta 6 archivos, máx 25MB cada uno)
- La IA puede analizar el contenido que adjuntes

## Tecnologías

- **Next.js 15** - Framework React
- **AI SDK Vercel 5** - Integración con modelos de IA
- **Google Gemini** - Modelo de IA conversacional
- **Tailwind CSS 4** - Estilos y efectos visuales
- **React 19** - Biblioteca de interfaz de usuario

## Estructura del Proyecto

```
src/
├── app/
│   ├── api/chat/route.js    # API endpoint para Gemini
│   ├── page.js              # Componente principal del chat
│   ├── layout.js            # Layout de la aplicación
│   └── globals.css          # Estilos globales
└── ...
```

## Efectos Visuales

Cuando `dragActive` es `true`:

- **Fondo**: `from-sky-50/80 to-white/80 backdrop-blur-md`
- **Chat Container**: `bg-white/60 backdrop-blur-xl border-2 border-sky-300 shadow-2xl`
- **Mensajes**: `bg-sky-100/80 backdrop-blur` y `bg-gray-100/80 backdrop-blur`
- **Overlay de Drop**: `bg-white/60 backdrop-blur-xl shadow-2xl`

Todas las transiciones usan `transition-all duration-300` para efectos suaves.

## Personalización

Puedes personalizar los efectos modificando las clases de Tailwind en `page.js`:

- Cambiar la intensidad del blur: `backdrop-blur-sm`, `backdrop-blur-md`, `backdrop-blur-lg`, `backdrop-blur-xl`
- Ajustar la transparencia: `bg-white/40`, `bg-white/60`, `bg-white/80`
- Modificar las transiciones: `duration-150`, `duration-300`, `duration-500`
