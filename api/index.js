// Punto de entrada para Vercel Serverless Functions
// Vercel busca automáticamente archivos en la carpeta /api/

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const QR_SECRET = process.env.QR_SECRET || 'sai-qr-super-secret-key-2024';
const QR_EXPIRY_SECONDS = 60;

/** Coincide con columna usuarios.rol (1 = admin/profesor, 2 = estudiante). */
const ROL_ADMIN = 1;
const ROL_ESTUDIANTE = 2;

app.use(cors());
app.use(express.json());

// ── Database Pool ─────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL no está definida. Se intentará conectar a localhost (esto fallará en Vercel).");
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://root:rootpassword@${process.env.DB_HOST || 'localhost'}:5432/asistenciadb`,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Test de conexión inicial
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error("❌ Error inicial de conexión a la BD:", err.message);
  } else {
    console.log("✅ Conexión a la base de datos establecida correctamente.");
  }
});

// ── Helpers ───────────────────────────────────────────────────
// Generador de códigos alfanuméricos de 16 caracteres
const generateQrToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Alias por compatibilidad si se usa en otros sitios
const generateRandomCode = generateQrToken;

// Rellena automáticamente las inasistencias de una sesión si ya pasó la hora límite
const autoFillAbsences = async (pool, sesionId) => {
  try {
    // 1. Obtener datos de la sesión y ver si ya fue procesada
    const sesRes = await pool.query('SELECT curso_id, limite_tarde, activa, faltas_procesadas FROM sesiones_clase WHERE id = $1', [sesionId]);
    if (sesRes.rows.length === 0) return;
    const s = sesRes.rows[0];

    // Si ya se procesó, no hacer nada más (ahorro de recursos)
    if (s.faltas_procesadas) return;

    // 2. ¿Debe llenarse ahora? 
    // Se llena si la sesión se cerró, o si ya pasó la hora límite
    const shouldFill = !s.activa || (await pool.query("SELECT TO_CHAR(NOW(), 'HH24:MI') > $1 as past", [s.limite_tarde])).rows[0].past;

    if (shouldFill) {
      // 3. Insertar inasistencias para alumnos faltantes
      await pool.query(`
        INSERT INTO asistencias (estudiante_id, sesion_id, estado, fecha_hora)
        SELECT ce.estudiante_id, $1, 'Falto', NOW()
        FROM curso_estudiantes ce
        WHERE ce.curso_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM asistencias a 
            WHERE a.estudiante_id = ce.estudiante_id AND a.sesion_id = $1
          )
      `, [sesionId, s.curso_id]);

      // 4. Marcar como procesada PARA SIEMPRE para esta sesión
      await pool.query('UPDATE sesiones_clase SET faltas_procesadas = true WHERE id = $1', [sesionId]);
      console.log(`[Auto-Falto] Sesión ${sesionId} procesada exitosamente.`);
    }
  } catch (err) {
    console.error("Error en autoFillAbsences:", err.message);
  }
};

// ── Migración Automática ──────────────────────────────────────
const runMigrations = async (pool) => {
  try {
    await pool.query(`
      ALTER TABLE sesiones_clase 
      ADD COLUMN IF NOT EXISTS faltas_procesadas BOOLEAN DEFAULT FALSE;
    `);
    console.log("Migración completada: columna faltas_procesadas asegurada.");
  } catch (err) {
    console.error("Error en migración:", err.message);
  }
};

// Ejecutar migración al iniciar
runMigrations(pool);

// ── ROUTES ────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', env: !!process.env.DATABASE_URL }));

// POST /api/auth/login — un solo campo `codigo`; el rol (1=admin/profesor, 2=estudiante) viene de la BD
app.post('/api/auth/login', async (req, res) => {
  const raw = req.body?.codigo ?? req.body?.codigo_estudiante;
  if (!raw || String(raw).trim() === '') return res.status(400).json({ error: 'Código requerido' });
  try {
    const r = await pool.query('SELECT * FROM usuarios WHERE codigo = $1', [String(raw).trim().toUpperCase()]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Código no encontrado' });
    const u = r.rows[0];
    const rol = Number(u.rol);
    if (rol !== ROL_ADMIN && rol !== ROL_ESTUDIANTE) {
      return res.status(403).json({ error: 'Rol de usuario no válido' });
    }
    res.json({ usuario: { ...u, rol } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sesiones/activa
app.get('/api/sesiones/activa', async (req, res) => {
  try {
    // 1. Buscamos sesión marcada como activa O programada para YA (hora actual >= hora programada)
    const r = await pool.query(`
      SELECT * FROM sesiones_clase 
      WHERE activa = true 
      OR (activa = false AND fecha_programada <= NOW() AND fecha_programada::date = CURRENT_DATE)
      ORDER BY activa DESC, fecha_programada DESC 
      LIMIT 1
    `);

    if (r.rows.length === 0) return res.status(404).json({ error: 'No hay sesión activa' });
    res.json({ sesion: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sesiones
app.post('/api/sesiones', async (req, res) => {
  const { nombre_clase, curso_id } = req.body;
  try {
    // Deactivate any other active session
    await pool.query('UPDATE sesiones_clase SET activa = false WHERE activa = true');
    const token = generateRandomCode();
    const r = await pool.query(
      'INSERT INTO sesiones_clase (nombre_clase, token_qr, activa, curso_id, fecha_inicio) VALUES ($1, $2, true, $3, NOW()) RETURNING *',
      [nombre_clase, token, curso_id]
    );
    res.json({ sesion: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sesiones/:id
app.delete('/api/sesiones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Eliminar asistencias relacionadas primero (FK)
    await pool.query('DELETE FROM asistencias WHERE sesion_id = $1', [id]);
    // Eliminar la sesión
    const r = await pool.query('DELETE FROM sesiones_clase WHERE id = $1 RETURNING id', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sesiones/:id
app.put('/api/sesiones/:id', async (req, res) => {
  const { nombre_clase, fecha_programada, limite_puntual, limite_presente, limite_tarde } = req.body;
  try {
    const r = await pool.query(
      `UPDATE sesiones_clase 
       SET nombre_clase = $1, fecha_programada = $2, limite_puntual = $3, limite_presente = $4, limite_tarde = $5
       WHERE id = $6 RETURNING *`,
      [nombre_clase, fecha_programada, limite_puntual, limite_presente, limite_tarde, req.params.id]
    );
    res.json({ sesion: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sesiones/:id/terminar (Solo desactiva, no borra)
app.put('/api/sesiones/:id/terminar', async (req, res) => {
  try {
    await pool.query('UPDATE sesiones_clase SET activa = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sesiones/:id/token
app.put('/api/sesiones/:id/token', async (req, res) => {
  const { id } = req.params;
  const token = generateQrToken(id);
  try {
    const r = await pool.query('UPDATE sesiones_clase SET token_qr = $1 WHERE id = $2 RETURNING *', [token, id]);
    res.json({ sesion: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/asistencias
app.post('/api/asistencias', async (req, res) => {
  const { token_qr, estudiante_id, estado } = req.body;
  try {
    const alumno = await pool.query('SELECT id, rol FROM usuarios WHERE id = $1', [estudiante_id]);
    if (alumno.rows.length === 0) return res.status(400).json({ error: 'Usuario no encontrado' });
    if (Number(alumno.rows[0].rol) !== ROL_ESTUDIANTE) {
      return res.status(403).json({ error: 'Solo los estudiantes pueden registrar asistencia' });
    }

    // Buscamos sesión activa con ese token
    const sesion = await pool.query(`
      SELECT * FROM sesiones_clase 
      WHERE token_qr = $1 
      AND (activa = true OR fecha_programada::date = CURRENT_DATE)
    `, [token_qr]);

    if (sesion.rows.length === 0) return res.status(400).json({ error: 'Código inválido o clase no disponible' });

    const sesionId = sesion.rows[0].id;

    const existe = await pool.query('SELECT id FROM asistencias WHERE estudiante_id = $1 AND sesion_id = $2', [estudiante_id, sesionId]);
    if (existe.rows.length > 0) return res.status(409).json({ error: 'Asistencia ya registrada' });

    const r = await pool.query(
      'INSERT INTO asistencias (estudiante_id, sesion_id, estado) VALUES ($1, $2, $3) RETURNING *',
      [estudiante_id, sesionId, estado]
    );
    res.json({ asistencia: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// GET /api/estudiantes (Now usuarios)
app.get('/api/estudiantes', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM usuarios WHERE rol = $1 ORDER BY nombre_completo',
      [ROL_ESTUDIANTE]
    );
    res.json({ estudiantes: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/estudiantes/:id (Now usuarios)
app.put('/api/estudiantes/:id', async (req, res) => {
  const { codigo, nombre_completo } = req.body;
  try {
    const r = await pool.query(
      'UPDATE usuarios SET codigo = $1, nombre_completo = $2 WHERE id = $3 RETURNING *',
      [codigo, nombre_completo, req.params.id]
    );
    res.json({ estudiante: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/estudiantes/:id/cursos
app.get('/api/estudiantes/:id/cursos', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT c.* FROM cursos c
      JOIN curso_estudiantes ce ON ce.curso_id = c.id
      WHERE ce.estudiante_id = $1 ORDER BY c.created_at DESC
    `, [req.params.id]);
    res.json({ cursos: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/asistencias/:id
app.put('/api/asistencias/:id', async (req, res) => {
  try {
    const r = await pool.query('UPDATE asistencias SET estado = $1 WHERE id = $2 RETURNING *', [req.body.estado, req.params.id]);
    res.json({ asistencia: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/asistencias/alumno/:id
app.get('/api/asistencias/alumno/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.id, a.estado, a.fecha_hora, s.nombre_clase, s.curso_id
       FROM asistencias a JOIN sesiones_clase s ON a.sesion_id = s.id
       WHERE a.estudiante_id = $1 ORDER BY a.fecha_hora DESC`, [req.params.id]
    );
    res.json({ historial: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/asistencias/historial
app.get('/api/asistencias/historial', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.id, a.estado, a.fecha_hora, a.sesion_id, a.estudiante_id, u.nombre_completo, u.codigo, s.nombre_clase
       FROM asistencias a
       JOIN usuarios u ON u.id = a.estudiante_id
       JOIN sesiones_clase s ON s.id = a.sesion_id
       ORDER BY a.fecha_hora DESC`
    );
    res.json({ historial: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/asistencias/:sesion_id
app.get('/api/asistencias/:sesion_id', async (req, res) => {
  const { sesion_id } = req.params;
  try {
    // Intentar auto-llenar faltas antes de devolver la lista
    await autoFillAbsences(pool, sesion_id);

    const r = await pool.query(
      `SELECT a.id, a.estado, a.fecha_hora, u.nombre_completo, u.codigo
       FROM asistencias a JOIN usuarios u ON u.id = a.estudiante_id
       WHERE a.sesion_id = $1 ORDER BY a.fecha_hora ASC`, [sesion_id]
    );
    res.json({ asistencias: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/asistencias/manual
app.post('/api/asistencias/manual', async (req, res) => {
  const { estudiante_id, sesion_id, estado } = req.body;
  try {
    const r = await pool.query(
      'INSERT INTO asistencias (estudiante_id, sesion_id, estado) VALUES ($1, $2, $3) RETURNING *',
      [estudiante_id, sesion_id, estado]
    );
    res.json({ asistencia: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/configuracion
app.get('/api/configuracion', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM configuracion_horario WHERE id = 1');
    res.json({ config: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/configuracion
app.put('/api/configuracion', async (req, res) => {
  const { limite_puntual, limite_presente, limite_tarde, permitir_falto } = req.body;
  try {
    const r = await pool.query(
      `UPDATE configuracion_horario 
       SET limite_puntual = $1, limite_presente = $2, limite_tarde = $3, permitir_falto = $4 
       WHERE id = 1 RETURNING *`,
      [limite_puntual, limite_presente, limite_tarde, permitir_falto]
    );
    res.json({ config: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── CURSOS ─────────────────────────────────────────────────

// GET /api/cursos
app.get('/api/cursos', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM curso_estudiantes ce WHERE ce.curso_id = c.id)::int AS total_alumnos,
        (SELECT COUNT(*) FROM sesiones_clase sc WHERE sc.curso_id = c.id)::int AS total_clases
      FROM cursos c ORDER BY c.created_at DESC
    `);
    res.json({ cursos: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/cursos
app.post('/api/cursos', async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    const r = await pool.query('INSERT INTO cursos (nombre, descripcion) VALUES ($1, $2) RETURNING *', [nombre, descripcion || '']);
    res.json({ curso: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/cursos/:id
app.put('/api/cursos/:id', async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    const r = await pool.query('UPDATE cursos SET nombre=$1, descripcion=$2 WHERE id=$3 RETURNING *', [nombre, descripcion, req.params.id]);
    res.json({ curso: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/cursos/:id
app.delete('/api/cursos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM cursos WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cursos/:id/estudiantes
app.get('/api/cursos/:id/estudiantes', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.* FROM usuarios u
      JOIN curso_estudiantes ce ON ce.estudiante_id = u.id
      WHERE ce.curso_id = $1 ORDER BY u.nombre_completo
    `, [req.params.id]);
    res.json({ estudiantes: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/cursos/:id/estudiantes  (add student to course)
app.post('/api/cursos/:id/estudiantes', async (req, res) => {
  const { estudiante_id } = req.body;
  try {
    await pool.query('INSERT INTO curso_estudiantes (curso_id, estudiante_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, estudiante_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/cursos/:cursoId/estudiantes/:estudianteId
app.delete('/api/cursos/:cursoId/estudiantes/:estudianteId', async (req, res) => {
  try {
    await pool.query('DELETE FROM curso_estudiantes WHERE curso_id=$1 AND estudiante_id=$2', [req.params.cursoId, req.params.estudianteId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cursos/:id/sesiones
app.get('/api/cursos/:id/sesiones', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT sc.*, 
        (SELECT COUNT(*) FROM asistencias a WHERE a.sesion_id = sc.id)::int AS total_asistencias
      FROM sesiones_clase sc WHERE sc.curso_id = $1 ORDER BY sc.fecha_programada ASC NULLS LAST, sc.fecha_inicio DESC
    `, [req.params.id]);
    res.json({ sesiones: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/cursos/:id/sesiones  (schedule a class)
app.post('/api/cursos/:id/sesiones', async (req, res) => {
  const { nombre_clase, fecha_programada, limite_puntual, limite_presente, limite_tarde, permitir_falto } = req.body;
  try {
    const token = generateRandomCode();
    const r = await pool.query(
      `INSERT INTO sesiones_clase 
        (nombre_clase, token_qr, activa, curso_id, fecha_programada, limite_puntual, limite_presente, limite_tarde, permitir_falto) 
       VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [nombre_clase, token, req.params.id, fecha_programada, limite_puntual, limite_presente, limite_tarde, permitir_falto]
    );
    res.json({ sesion: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/sesiones/:id/activar  (start a scheduled session)
app.put('/api/sesiones/:id/activar', async (req, res) => {
  try {
    // Deactivate any other active session
    await pool.query('UPDATE sesiones_clase SET activa = false WHERE activa = true');
    const token = generateRandomCode();
    const r = await pool.query(
      'UPDATE sesiones_clase SET activa = true, token_qr = $1, fecha_inicio = NOW() WHERE id = $2 RETURNING *',
      [token, req.params.id]
    );
    res.json({ sesion: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/sesiones/:id/terminar  (manually end a session)
app.put('/api/sesiones/:id/terminar', async (req, res) => {
  try {
    const sesionId = req.params.id;
    // 1. Desactivar la sesión
    await pool.query('UPDATE sesiones_clase SET activa = false WHERE id = $1', [sesionId]);
    
    // 2. Ejecutar auto-llenado de faltas inmediatamente
    await autoFillAbsences(pool, sesionId);
    
    res.json({ ok: true, message: 'Sesión terminada y inasistencias registradas' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cursos/:id/historial  (attendance matrix filtered by course)
app.get('/api/cursos/:id/historial', async (req, res) => {
  try {
    const cursoId = req.params.id;

    // Auto-llenar faltas para las sesiones de este curso que ya deberían haber terminado
    // Esto asegura que la matriz esté completa al verla
    const sesionesRes = await pool.query('SELECT id FROM sesiones_clase WHERE curso_id = $1', [cursoId]);
    for (const s of sesionesRes.rows) {
      await autoFillAbsences(pool, s.id);
    }

    const r = await pool.query(`
      SELECT a.id, a.estado, a.fecha_hora, a.sesion_id, a.estudiante_id, 
             u.nombre_completo, u.codigo, s.nombre_clase
      FROM asistencias a
      JOIN usuarios u ON u.id = a.estudiante_id
      JOIN sesiones_clase s ON s.id = a.sesion_id
      WHERE s.curso_id = $1
      ORDER BY a.fecha_hora DESC
    `, [cursoId]);
    res.json({ historial: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default app;
