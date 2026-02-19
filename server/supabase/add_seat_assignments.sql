-- ============================================================
-- FIX: Agregar soporte para asignación de asientos individual
-- ============================================================
-- Ejecutar en Supabase SQL Editor (Dashboard)

-- 1. Agregar columna para asignaciones individuales
-- Estructura: {"-1": "table_uuid", "0": "table_uuid", "1": "table_uuid"}
-- Donde "-1" es el invitado principal, y "0", "1"... son los índices de acompañantes.
ALTER TABLE public.guests ADD COLUMN seat_assignments JSONB DEFAULT '{}'::jsonb;

-- 2. Migrar datos existentes (opcional)
-- Si ya tienen assigned_table_id, se puede dejar como fallback o migrarlo.
-- Por ahora, el código usará assigned_table_id como valor por defecto si no hay entrada en seat_assignments.
