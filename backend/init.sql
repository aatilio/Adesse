-- ============================================================
-- ADESE – Asistencia Digital Estratégica para el Sector Educativo
-- Esquema de Base de Datos v2.0 (Multi-Curso)
-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE usuarios (
  id              SERIAL      PRIMARY KEY,
  codigo          TEXT        NOT NULL UNIQUE,
  nombre_completo TEXT        NOT NULL,
  rol             INT         NOT NULL DEFAULT 2, -- 1 = administrador (profesor), 2 = estudiante
  device_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: cursos
-- ============================================================
CREATE TABLE cursos (
  id          SERIAL      PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT         DEFAULT '',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: curso_estudiantes  (muchos a muchos)
-- ============================================================
CREATE TABLE curso_estudiantes (
  id             SERIAL PRIMARY KEY,
  curso_id       INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  estudiante_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE(curso_id, estudiante_id)
);

-- ============================================================
-- TABLA: sesiones_clase
-- ============================================================
CREATE TABLE sesiones_clase (
  id                SERIAL      PRIMARY KEY,
  nombre_clase      TEXT        NOT NULL,
  token_qr          TEXT,
  activa            BOOLEAN     NOT NULL DEFAULT FALSE,
  curso_id          INT         REFERENCES cursos(id) ON DELETE SET NULL,
  fecha_programada  TIMESTAMPTZ,
  limite_puntual    VARCHAR(5),
  limite_presente   VARCHAR(5),
  limite_tarde      VARCHAR(5),
  permitir_falto    BOOLEAN     DEFAULT TRUE,
  fecha_inicio      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: asistencias
-- ============================================================
CREATE TABLE asistencias (
  id             SERIAL      PRIMARY KEY,
  estudiante_id  INT         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sesion_id      INT         NOT NULL REFERENCES sesiones_clase(id) ON DELETE CASCADE,
  fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado         TEXT        NOT NULL DEFAULT 'Presente',
  UNIQUE(estudiante_id, sesion_id)
);

-- ============================================================
-- TABLA: configuracion_horario
-- ============================================================
CREATE TABLE configuracion_horario (
  id               INT         PRIMARY KEY DEFAULT 1,
  limite_puntual   VARCHAR(5)  NOT NULL DEFAULT '06:59',
  limite_presente  VARCHAR(5)  NOT NULL DEFAULT '07:20',
  limite_tarde     VARCHAR(5)  NOT NULL DEFAULT '08:20',
  permitir_falto   BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO configuracion_horario (id, limite_puntual, limite_presente, limite_tarde, permitir_falto)
VALUES (1, '06:59', '07:20', '08:20', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_asistencias_sesion     ON asistencias(sesion_id);
CREATE INDEX idx_asistencias_estudiante ON asistencias(estudiante_id);
CREATE INDEX idx_sesiones_activa        ON sesiones_clase(activa);
CREATE INDEX idx_sesiones_curso         ON sesiones_clase(curso_id);
CREATE INDEX idx_curso_est_curso        ON curso_estudiantes(curso_id);

-- ============================================================
-- DATOS INICIALES: Usuarios (rol por defecto 2 = estudiante)
-- ============================================================
INSERT INTO usuarios (codigo, nombre_completo) VALUES
  ('20241417', 'Anconeira Bejar Emanuel Alejandro'),
  ('20221252', 'Anquise Colque Carmen Rosa'),
  ('20241408', 'Apaza Apaza Valeria Abigail'),
  ('20241411', 'Apaza Hanccoccallo Juber Efrain'),
  ('20243826', 'Baca Sivincha Jheiner Alexander'),
  ('20243818', 'Callizaya Sanchez Mirian Noemi'),
  ('20242713', 'Canaza Tito Brendalith Fiorella'),
  ('20243848', 'Cardeña Lovon Joan Ernesto'),
  ('20242723', 'Casani Mollo Said Zoilo'),
  ('20241370', 'Castillo Cardenas Luis Moises'),
  ('20241398', 'Castro Palma Nayely Solance'),
  ('20241387', 'Ccanchi Quispe Alex Nicolas'),
  ('20243812', 'Chambi Espinoza Liliam Adriana'),
  ('20193626', 'Chui Huisa Luis Rodrigo'),
  ('20243838', 'Condori Arapa Alan Atilio'),
  ('20241426', 'Condori Chipana Nicoll Silvia'),
  ('20243810', 'Cutipa Colca Luis Enrique'),
  ('20242709', 'Duran Chancolla Benjamin Maximo'),
  ('20242684', 'Enriquez Pacco Brith Yakelin'),
  ('20243836', 'Figueroa Arela Emerson'),
  ('20235379', 'Flores Condo Maribel'),
  ('20241371', 'Hancco Huaman Sheyla Adeli'),
  ('20241439', 'Herrera Caso Ian Mathiaz Vladimir'),
  ('20242685', 'Huanqui Turpo Christian Ismael'),
  ('20241388', 'Huarca Ccapa Alex Rodrigo'),
  ('20243842', 'Leon Parisaca Maria Del Pilar'),
  ('20243808', 'Lopez Perez Fabinho Jorge'),
  ('20241399', 'Mamani Calisaya Eduardo Fabian'),
  ('20241419', 'Mamani Hancco Gabriel Fernando'),
  ('20243822', 'Mamani Roque Alexis Ronald'),
  ('20242706', 'Medina Huarsaya Christopher Luis'),
  ('20242715', 'Morante Torres Carlos Estefano'),
  ('20241413', 'Morocco Quispe Dihana Gabriela'),
  ('20231018', 'Nuñoncca Huaycho Juan Ricardo'),
  ('20243829', 'Oblitas Caraballo Uzuel'),
  ('20241372', 'Pacompia Capacoila Luis Angel'),
  ('20241360', 'Palomino Mamani Alvaro Fabrizio'),
  ('20241407', 'Quispe Aguilar Diego Adriel Gedeon'),
  ('20242714', 'Quispe Castillo Rose Sthefany'),
  ('20200218', 'Quispe Ortega Yefry Andersson'),
  ('20242697', 'Quispe Quispe Yorlan Ruben'),
  ('20241377', 'Ramos Con Yoisi Madelin'),
  ('20234109', 'Ramos Mucha Angel Eliasin'),
  ('20241378', 'Rodriguez Bordon Sebastian Gianfranco'),
  ('20242683', 'Salcedo Vargas Mayly Araceli'),
  ('20242686', 'Samayani Capira Yvan Nistel Roy'),
  ('20233806', 'Soncco Murillo Nestor Luis'),
  ('20241366', 'Suri Huamani Dayana Betsabeth'),
  ('20232383', 'Taipe Ccorimanya Maryorie Kassandra'),
  ('20241436', 'Ticona Condori Andree Rafael'),
  ('20241359', 'Ucsa Carcamo Alexander Jesus'),
  ('20241428', 'Vilca Duran Jainer Carlos'),
  ('20242682', 'Villavicencio Chire Sebastian Enrique'),
  ('20241397', 'Yauri Moran Gabriel Alexander')
ON CONFLICT (codigo) DO NOTHING;

-- 1 = administrador (profesor)
INSERT INTO usuarios (codigo, nombre_completo, rol) VALUES
  ('AR00T', 'Administrador', 1)
ON CONFLICT (codigo) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo, rol = EXCLUDED.rol;

-- ============================================================
-- DATOS INICIALES: Curso "Econometría" con todos los alumnos
-- ============================================================
INSERT INTO cursos (nombre, descripcion)
VALUES ('Econometría', 'Curso principal — todos los alumnos inscritos');

-- Inscribir a todos los alumnos (excepto administrador) en Econometría
INSERT INTO curso_estudiantes (curso_id, estudiante_id)
SELECT
  (SELECT id FROM cursos WHERE nombre = 'Econometría' LIMIT 1),
  u.id
FROM usuarios u
WHERE u.rol = 2;

-- ============================================================
-- DATOS DE EJEMPLO: Sesión pasada del 13/04 con todos "Presente"
-- ============================================================
INSERT INTO sesiones_clase (nombre_clase, token_qr, activa, curso_id, fecha_programada, fecha_inicio)
VALUES (
  'Clase - 13/04',
  'token_historico_1304',
  false,
  (SELECT id FROM cursos WHERE nombre = 'Econometría' LIMIT 1),
  '2026-04-13 07:00:00-05',
  '2026-04-13 07:00:00-05'
);

INSERT INTO asistencias (estudiante_id, sesion_id, estado, fecha_hora)
SELECT
  u.id,
  (SELECT id FROM sesiones_clase WHERE nombre_clase = 'Clase - 13/04' LIMIT 1),
  'Presente',
  '2026-04-13 07:15:00-05'
FROM usuarios u
WHERE u.rol = 2;
