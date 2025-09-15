-- =====================================================
-- SCRIPT SQL COMPLETO PARA SOCIAL MEDIA AUTOMATION
-- =====================================================
-- Este script crea toda la estructura de base de datos necesaria
-- para que el proyecto funcione completamente con Supabase

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: profiles
-- =====================================================
-- Almacena tokens y credenciales de todas las redes sociales
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Instagram credenciales básicas (legacy)
    instagram_username TEXT,
    instagram_password TEXT,
    userinstagram TEXT, -- columna alternativa
    passwordinstagram TEXT, -- columna alternativa
    
    -- Instagram OAuth tokens
    instagram_access_token TEXT,
    instagram_expires_at TIMESTAMP WITH TIME ZONE,
    instagram_user_id TEXT,
    instagram_username_oauth TEXT,
    instagram_granted_scopes JSONB,
    
    -- Facebook OAuth tokens
    facebook_access_token TEXT,
    facebook_expires_at TIMESTAMP WITH TIME ZONE,
    facebook_user_id TEXT,
    facebook_user_name TEXT,
    facebook_granted_scopes JSONB,
    facebook_page_id TEXT,
    facebook_page_name TEXT,
    
    -- YouTube OAuth tokens
    youtube_access_token TEXT,
    youtube_refresh_token TEXT,
    youtube_expires_at TIMESTAMP WITH TIME ZONE,
    youtube_channel_id TEXT,
    youtube_channel_name TEXT,
    youtube_channel_title TEXT, -- columna alternativa
    youtube_granted_scopes JSONB,
    
    -- TikTok OAuth tokens
    tiktok_access_token TEXT,
    tiktok_refresh_token TEXT,
    tiktok_expires_at TIMESTAMP WITH TIME ZONE,
    tiktok_open_id TEXT,
    tiktok_granted_scopes JSONB,
    
    -- AI Model Configuration
    ai_model TEXT DEFAULT 'gemini' CHECK (ai_model IN ('chatgpt', 'gemini', 'deepseek')),
    ai_api_key TEXT
);

-- =====================================================
-- TABLA: messages
-- =====================================================
-- Almacena el historial de conversaciones del chat
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT DEFAULT '',
    type TEXT DEFAULT 'text',
    attachments JSONB,
    meta JSONB
);

-- =====================================================
-- TABLA: scheduled_posts
-- =====================================================
-- Almacena publicaciones programadas para ejecutar automáticamente
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Información de la publicación
    content TEXT NOT NULL,
    platforms TEXT[] NOT NULL, -- Array de plataformas: ['instagram', 'facebook', 'youtube', 'tiktok']
    
    -- Programación
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    scheduled_datetime TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (
        (scheduled_date::timestamp + scheduled_time::interval) AT TIME ZONE 'UTC'
    ) STORED,
    
    -- Estado de ejecución
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
    executed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Metadatos
    media_urls JSONB, -- URLs de imágenes/videos adjuntos
    platform_results JSONB, -- Resultados de cada plataforma después de publicar
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
);

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para profiles
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles(updated_at);

-- Índices para messages
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS messages_user_created_idx ON public.messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS messages_type_idx ON public.messages(type);

-- Índices para scheduled_posts
CREATE INDEX IF NOT EXISTS scheduled_posts_user_id_idx ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_scheduled_datetime_idx ON public.scheduled_posts(scheduled_datetime);
CREATE INDEX IF NOT EXISTS scheduled_posts_status_idx ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS scheduled_posts_user_status_idx ON public.scheduled_posts(user_id, status);
CREATE INDEX IF NOT EXISTS scheduled_posts_pending_datetime_idx ON public.scheduled_posts(scheduled_datetime) WHERE status = 'pending';

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
-- Los usuarios solo pueden ver y modificar su propio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.profiles
    FOR DELETE USING (auth.uid() = id);

-- Políticas para messages
-- Los usuarios solo pueden ver y modificar sus propios mensajes
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para scheduled_posts
-- Los usuarios solo pueden ver y modificar sus propias publicaciones programadas
CREATE POLICY "Users can view own scheduled posts" ON public.scheduled_posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled posts" ON public.scheduled_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled posts" ON public.scheduled_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled posts" ON public.scheduled_posts
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para profiles
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger para scheduled_posts
CREATE TRIGGER scheduled_posts_updated_at
    BEFORE UPDATE ON public.scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- FUNCIÓN PARA CREAR PERFIL AUTOMÁTICAMENTE
-- =====================================================

-- Función que crea un perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que ejecuta la función cuando se crea un nuevo usuario
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- CONFIGURACIÓN DE AUTENTICACIÓN
-- =====================================================

-- Habilitar registro de usuarios (opcional, se puede configurar desde el dashboard)
-- UPDATE auth.config SET enable_signup = true;

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =====================================================

-- Insertar un usuario de prueba (descomenta si necesitas datos de prueba)
/*
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'test@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
);
*/

-- =====================================================
-- VERIFICACIÓN DE LA INSTALACIÓN
-- =====================================================

-- Consulta para verificar que todo se creó correctamente
SELECT 
    'profiles' as tabla,
    COUNT(*) as registros
FROM public.profiles
UNION ALL
SELECT 
    'messages' as tabla,
    COUNT(*) as registros
FROM public.messages;

-- Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'messages');

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
1. Este script debe ejecutarse en Supabase SQL Editor
2. Asegúrate de tener las variables de entorno configuradas:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
3. Los tokens OAuth se almacenan de forma segura con RLS
4. Cada usuario solo puede acceder a sus propios datos
5. Los perfiles se crean automáticamente al registrarse
6. Las columnas alternativas (userinstagram, passwordinstagram) 
   proporcionan compatibilidad con versiones anteriores
*/

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

SELECT 'Base de datos configurada correctamente para Social Media Automation' as status;