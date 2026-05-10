# Guía de Migración y Optimización: Sistema de Asistencia

Este documento contiene las instrucciones técnicas para el agente de programación encargado de realizar la migración de la base de datos PostgreSQL en el entorno Docker local.

## 1. Contexto y Objetivo
Actualmente, la tabla `asistencias` almacena el estado como texto plano (`VARCHAR`). Se requiere normalizar esta estructura creando una tabla maestra `estados_asistencia` que contenga metadatos (colores y puntuación) para que el sistema sea dinámico.

**Objetivos principales:**
* Eliminar el "hardcoding" de colores en el Frontend (React).
* Facilitar el cálculo de asistencia en el Backend (Express) mediante valores numéricos.
* Migrar los registros existentes sin pérdida de integridad.

---

## 2. Definición del Nuevo Esquema

### A. Tabla Maestra: `estados_asistencia`
Esta tabla define las reglas de negocio:
* **color**: Para inyección directa en estilos de React (Hexadecimal).
* **puntuacion**: Para cálculos matemáticos de asistencia (Decimal).

### B. Tabla Modificada: `asistencias`
* Cambio de la columna `estado` (VARCHAR) por `estado_id` (INT) como llave foránea vinculada a `estados_asistencia`.

---

## 3. Script SQL Unificado de Ejecución

El agente debe ejecutar el siguiente bloque de código en la base de datos `asitenciadb`:

```sql
-- 1. Crear tabla maestra de estados
CREATE TABLE IF NOT EXISTS estados_asistencia (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(20) UNIQUE NOT NULL,
    color VARCHAR(7) NOT NULL,
    puntuacion DECIMAL(3,2) NOT NULL
);

-- 2. Insertar valores maestros iniciales con lógica de colores y puntos
INSERT INTO estados_asistencia (id, nombre, color, puntuacion) VALUES
(1, 'Puntual', '#22C55E', 1.00),
(2, 'Presente', '#3B82F6', 1.00),
(3, 'Tarde', '#EAB308', 0.50),
(4, 'Falto', '#EF4444', 0.00),
(5, 'Justificado', '#A855F7', 1.00)
ON CONFLICT (id) DO UPDATE SET color = EXCLUDED.color, puntuacion = EXCLUDED.puntuacion;

-- 3. Re-estructuración de la tabla asistencias
-- Se usa DROP/CREATE para asegurar una base limpia en el entorno de desarrollo local
DROP TABLE IF EXISTS asistencias;
CREATE TABLE asistencias (
    id SERIAL PRIMARY KEY,
    estudiante_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sesion_id INT NOT NULL REFERENCES sesiones_clase(id) ON DELETE CASCADE,
    estado_id INT NOT NULL REFERENCES estados_asistencia(id),
    dispositivo_id TEXT,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(estudiante_id, sesion_id)
);

-- 4. Migración de datos con mapeo de IDs
-- Se deben procesar los registros convirtiendo los strings originales a IDs numéricos
-- Mapeo: 'Puntual'->1, 'Presente'->2, 'Tarde'->3, 'Falto'->4, 'Justificado'->5

INSERT INTO "public"."asistencias" ("id", "estudiante_id", "sesion_id", "estado_id", "dispositivo_id", "fecha_hora") VALUES
-- Ejemplo de registros migrados (El agente debe aplicar esta lógica a la lista completa de registros)
(1, 2, 1, 1, null, '2026-04-13 12:15:00+00'),
(56, 3, 2, 2, null, '2026-04-15 12:10:00+00'),
(207, 15, 4, 4, null, '2026-04-20 14:32:06.788224+00'),
(361, 31, 8, 3, null, '2026-04-22 13:28:46.686734+00');

-- 5. Sincronización de secuencias (CRÍTICO para evitar errores de llave duplicada)
SELECT setval('asistencias_id_seq', (SELECT MAX(id) FROM asistencias));
SELECT setval('estados_asistencia_id_seq', (SELECT MAX(id) FROM estados_asistencia));