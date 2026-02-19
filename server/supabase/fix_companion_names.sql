-- ============================================================
-- FIX: Cambiar companion_names de TEXT[] a JSONB
-- ============================================================
-- Ejecutar en Supabase SQL Editor (Dashboard)
-- 
-- Problema: La columna companion_names fue creada como TEXT[] 
-- pero el frontend/backend esperan JSONB con estructura:
-- {"adults": [], "teens": [], "kids": [], "infants": []}
--
-- El backend ahora maneja ambos formatos, pero esta migración
-- es recomendable para consistencia a futuro.
-- ============================================================

-- 1. Primero verificar el tipo actual
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'guests' AND column_name = 'companion_names';

-- 2. Si es _text (TEXT[]), ejecutar esta migración:
-- NOTA: Hacer BACKUP antes de ejecutar!

-- Paso A: Renombrar la columna vieja
ALTER TABLE public.guests RENAME COLUMN companion_names TO companion_names_old;

-- Paso B: Crear la nueva columna JSONB
ALTER TABLE public.guests ADD COLUMN companion_names JSONB 
  DEFAULT '{"adults": [], "teens": [], "kids": [], "infants": []}'::jsonb;

-- Paso C: Migrar datos existentes
-- Si los datos son TEXT[] con un solo elemento JSON-encoded:
UPDATE public.guests 
SET companion_names = CASE 
    WHEN companion_names_old IS NULL THEN '{"adults": [], "teens": [], "kids": [], "infants": []}'::jsonb
    WHEN array_length(companion_names_old, 1) = 1 THEN 
        CASE 
            WHEN companion_names_old[1]::jsonb IS NOT NULL THEN companion_names_old[1]::jsonb
            ELSE '{"adults": [], "teens": [], "kids": [], "infants": []}'::jsonb
        END
    ELSE '{"adults": [], "teens": [], "kids": [], "infants": []}'::jsonb
END;

-- Paso D: Eliminar la columna vieja (después de verificar que todo está bien)
-- ALTER TABLE public.guests DROP COLUMN companion_names_old;

-- 3. Verificar resultado:
SELECT id, name, companion_names FROM public.guests LIMIT 5;
