-- ============================================================
-- MIGRACIÓN v2: Normalización de estados de asistencia
-- Base de datos: asistenciadb
-- Fecha: 2026-05-10
-- ============================================================
-- Este script:
--   1. Crea la tabla maestra estados_asistencia
--   2. Migra la columna 'estado' (VARCHAR) → 'estado_id' (INT FK)
--   3. Preserva TODOS los registros existentes sin pérdida
-- ============================================================

BEGIN;

-- ── 1. Crear tabla maestra de estados ──────────────────────
CREATE TABLE IF NOT EXISTS estados_asistencia (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(20) UNIQUE NOT NULL,
    color VARCHAR(7) NOT NULL,
    puntuacion DECIMAL(3,2) NOT NULL
);

-- ── 2. Insertar valores maestros ───────────────────────────
INSERT INTO estados_asistencia (id, nombre, color, puntuacion) VALUES
(1, 'Puntual',     '#22C55E', 1.00),
(2, 'Presente',    '#3B82F6', 1.00),
(3, 'Tarde',       '#EAB308', 0.50),
(4, 'Falto',       '#EF4444', 0.00),
(5, 'Justificado', '#A855F7', 1.00)
ON CONFLICT (id) DO UPDATE SET
  color = EXCLUDED.color,
  puntuacion = EXCLUDED.puntuacion;

-- Sincronizar secuencia de estados
SELECT setval('estados_asistencia_id_seq', (SELECT MAX(id) FROM estados_asistencia));

-- ── 3. Migrar columna estado → estado_id (sin perder datos) ─
-- 3a. Agregar nueva columna estado_id
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS estado_id INT;

-- 3b. Poblar estado_id a partir del texto existente
UPDATE asistencias SET estado_id = CASE estado
    WHEN 'Puntual'     THEN 1
    WHEN 'Presente'    THEN 2
    WHEN 'Tarde'       THEN 3
    WHEN 'Falto'       THEN 4
    WHEN 'Justificado' THEN 5
END
WHERE estado_id IS NULL;

-- 3c. Hacer estado_id NOT NULL y agregar FK
ALTER TABLE asistencias ALTER COLUMN estado_id SET NOT NULL;
ALTER TABLE asistencias ADD CONSTRAINT fk_asistencias_estado
    FOREIGN KEY (estado_id) REFERENCES estados_asistencia(id);

-- 3d. Eliminar la columna vieja de texto
ALTER TABLE asistencias DROP COLUMN IF EXISTS estado;

COMMIT;

-- ============================================================
-- VERIFICACIÓN (ejecutar manualmente después si se desea)
-- ============================================================
-- SELECT a.id, u.nombre_completo, ea.nombre AS estado, ea.color, ea.puntuacion
-- FROM asistencias a
-- JOIN usuarios u ON u.id = a.estudiante_id
-- JOIN estados_asistencia ea ON ea.id = a.estado_id
-- LIMIT 10;
