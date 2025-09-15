-- =====================================================
-- MIGRACIÓN: Agregar configuración de IA a profiles
-- =====================================================
-- Este script agrega las columnas necesarias para la configuración
-- de modelos de IA y API keys en la tabla profiles existente

-- Agregar columnas para configuración de IA
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini' CHECK (ai_model IN ('chatgpt', 'gemini', 'deepseek')),
ADD COLUMN IF NOT EXISTS ai_api_key TEXT;

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND column_name IN ('ai_model', 'ai_api_key')
ORDER BY column_name;

-- Mensaje de confirmación
SELECT 'Migración de configuración de IA completada exitosamente' as status;