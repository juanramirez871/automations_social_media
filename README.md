# 🚀 Social Media Automation Platform

> **Plataforma inteligente de automatización para redes sociales con IA integrada**

Una aplicación web moderna que permite crear, programar y publicar contenido automáticamente en múltiples plataformas de redes sociales utilizando inteligencia artificial para generar contenido optimizado.

## ✨ Características Principales

### 🤖 **Asistente IA Integrado**
- **Chat inteligente** para crear contenido
- **Generación automática** de descripciones y hashtags
- **Sugerencias personalizadas** basadas en tu audiencia
- **Optimización de contenido** para cada plataforma

### 📅 **Programación Avanzada**
- **Calendario visual** para gestionar publicaciones
- **Programación automática** con GitHub Actions
- **Ejecución cada 5 minutos** para máxima precisión
- **Gestión completa** (crear, editar, eliminar posts)

### 🌐 **Múltiples Plataformas**
- **Instagram** - Posts, Stories, Reels
- **Facebook** - Posts y Pages
- **YouTube** - Videos y Shorts
- **TikTok** - Videos virales
- **Más plataformas** próximamente

### 🎨 **Interfaz Moderna**
- **Diseño responsive** para todos los dispositivos
- **Chat interactivo** con widgets especializados
- **Calendario intuitivo** para visualizar posts
- **Gestión de archivos** con Cloudinary

## 🛠️ Tecnologías Utilizadas

### **Frontend**
- **Next.js 14** - Framework React moderno
- **Tailwind CSS** - Estilos utilitarios
- **React Hooks** - Gestión de estado
- **Responsive Design** - Adaptable a todos los dispositivos

### **Backend**
- **Next.js API Routes** - Endpoints RESTful
- **Supabase** - Base de datos PostgreSQL
- **GitHub Actions** - Automatización de tareas
- **Vercel** - Hosting y deployment

### **Integraciones**
- **Google Gemini AI** - Generación de contenido
- **Cloudinary** - Gestión de imágenes y videos
- **OAuth 2.0** - Autenticación segura
- **Social Media APIs** - Publicación automática

## 🚀 Instalación y Configuración

### **1. Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/automations_social_media.git
cd automations_social_media
```

### **2. Instalar dependencias**
```bash
npm install
```

### **3. Configurar variables de entorno**
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Cron Job Security
CRON_SECRET=tu_clave_secreta_aleatoria

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=tu_gemini_api_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### **4. Configurar base de datos**
```bash
# Ejecutar en Supabase SQL Editor
psql -f database_setup.sql
```

### **5. Ejecutar en desarrollo**
```bash
npm run dev
```

## 📖 Guía de Uso

### **🎯 Crear tu primera publicación**

1. **Inicia sesión** con tu cuenta
2. **Conecta tus redes sociales** desde el chat
3. **Describe tu contenido** al asistente IA
4. **Sube imágenes/videos** si es necesario
5. **Selecciona plataformas** donde publicar
6. **Programa fecha y hora** o publica inmediatamente

### **📅 Gestionar publicaciones programadas**

- **Abrir calendario** desde el menú
- **Ver posts programados** por fecha
- **Editar contenido** haciendo click en cualquier post
- **Eliminar posts** con el botón correspondiente
- **Monitorear ejecuciones** en GitHub Actions

### **🤖 Usar el asistente IA**

```
💬 "Crea un post sobre café para Instagram"
🤖 El asistente generará contenido optimizado

💬 "Programa este post para mañana a las 9 AM"
🤖 Configurará automáticamente la programación

💬 "Conectar mi cuenta de Instagram"
🤖 Te guiará por el proceso de OAuth
```

## 🏗️ Arquitectura del Sistema

### **📊 Diagrama de Flujo**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Supabase DB   │
│   (Next.js)     │◄──►│   (Next.js)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub        │    │   Social Media  │    │   Cloudinary    │
│   Actions       │    │   APIs          │    │   (Media)       │
│   (Cron Jobs)   │    │   (Publishing)  │    │   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **🔄 Flujo de Publicación Automática**

1. **Usuario programa post** → Guardado en Supabase
2. **GitHub Actions** ejecuta cada 5 minutos
3. **API verifica** posts pendientes
4. **Publica automáticamente** en redes sociales
5. **Actualiza estado** a completado

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/                    # Endpoints de la API
│   │   ├── scheduled-posts/    # CRUD de posts programados
│   │   ├── execute-scheduled-posts/  # Ejecución automática
│   │   └── upload/             # Subida de archivos
│   ├── globals.css             # Estilos globales
│   ├── layout.js               # Layout principal
│   └── page.js                 # Página principal
├── components/
│   ├── CalendarModal.jsx       # Calendario de posts
│   ├── Composer.jsx            # Editor de mensajes
│   └── widgets/                # Widgets especializados
├── hooks/
│   └── useChatState.js         # Estado del chat
└── lib/
    ├── supabaseClient.js       # Cliente de Supabase
    ├── publishFlowUtils.js     # Utilidades de publicación
    └── messageTransformers.js  # Transformadores de mensajes
```

## 🔧 Configuración Avanzada

### **⚙️ GitHub Actions (Automatización)**

1. **Configurar secretos** en GitHub:
   - `VERCEL_URL`: URL de tu aplicación
   - `CRON_SECRET`: Clave de seguridad

2. **El workflow** se ejecuta automáticamente cada 5 minutos

3. **Monitorear logs** en la pestaña Actions

### **Variables de producción**
```env
# Todas las variables de .env.local
# Más configuraciones específicas de producción
NODE_ENV=production
NEXTAUTH_URL=https://tu-dominio.vercel.app
```

## 📊 Características Técnicas

### **🔒 Seguridad**
- **Autenticación OAuth 2.0**
- **Row Level Security** en Supabase
- **API Keys** protegidas
- **CORS** configurado correctamente

### **⚡ Performance**
- **Server-side rendering** con Next.js
- **Optimización de imágenes** automática
- **Caching** inteligente
- **Bundle splitting** automático

### **📱 Responsive Design**
- **Mobile-first** approach
- **Breakpoints** optimizados
- **Touch-friendly** interfaces
- **PWA ready** (Progressive Web App)

## 🤝 Contribuir

### **✨ Nuevas características**
1. **Fork** del repositorio
2. **Crear branch** para tu feature
3. **Commit** con mensajes descriptivos
4. **Pull request** con descripción detallada

---

<div align="center">

**¿Te gusta el proyecto? ¡Dale una ⭐ en GitHub!**

</div>