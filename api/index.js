// Punto de entrada para Vercel Serverless Functions
// Vercel busca automáticamente archivos en la carpeta /api/

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const QR_SECRET = process.env.QR_SECRET || 'sai-qr-super-secret-key-2024';
const QR_EXPIRY_SECONDS = 15;

app.use(cors());
app.use(express.json());

// ── Database Pool ─────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Helpers ───────────────────────────────────────────────────
const generateRandomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ── ROUTES ────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', env: !!process.env.DATABASE_URL }));

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { codigo_estudiante } = req.body;
  if (!codigo_estudiante) return res.status(400).json({ error: 'Código requerido' });
  try {
    const r = await pool.query('SELECT * FROM estudiantes WHERE codigo_estudiante = $1', [codigo_estudiante.toUpperCase()]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Código no encontrado' });
    res.json({ estudiante: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sesiones/activa
app.get('/api/sesiones/activa', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM sesiones_clase WHERE activa = true ORDER BY fecha_inicio DESC LIMIT 1`);
    if (r.rows.length === 0) return res.status(404).json({ error: 'No hay sesión activa' });
    res.json({ sesion: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sesiones
app.post('/api/sesiones', async (req, res) => {
  const { nombre_clase } = req.body;
  try {
    await pool.query('UPDATE sesiones_clase SET activa = false WHERE activa = true');
    const token = generateRandomCode();
    const r = await pool.query(
      'INSERT INTO sesiones_clase (nombre_clase, token_qr, activa) VALUES ($1, $2, true) RETURNING *',
      [nombre_clase, token]
    );
    res.json({ sesion: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sesiones/:id
app.delete('/api/sesiones/:id', async (req, res) => {
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
    await pool.query('UPDATE sesiones_clase SET token_qr = $1 WHERE id = $2', [token, id]);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/asistencias
app.post('/api/asistencias', async (req, res) => {
  const { token_qr, estudiante_id, estado } = req.body;
  try {
    const sesion = await pool.query('SELECT * FROM sesiones_clase WHERE token_qr = $1 AND activa = true', [token_qr]);
    if (sesion.rows.length === 0) return res.status(400).json({ error: 'Código inválido o sesión inactiva' });

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



// GET /api/estudiantes
app.get('/api/estudiantes', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM estudiantes ORDER BY nombre_completo');
    res.json({ estudiantes: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/estudiantes/:id
app.put('/api/estudiantes/:id', async (req, res) => {
  const { codigo_estudiante, nombre_completo } = req.body;
  try {
    const r = await pool.query(
      'UPDATE estudiantes SET codigo_estudiante = $1, nombre_completo = $2 WHERE id = $3 RETURNING *',
      [codigo_estudiante, nombre_completo, req.params.id]
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
      `SELECT a.id, a.estado, a.fecha_hora, a.sesion_id, a.estudiante_id, e.nombre_completo, e.codigo_estudiante, s.nombre_clase
       FROM asistencias a
       JOIN estudiantes e ON e.id = a.estudiante_id
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
  try {
    const r = await pool.query(
      `SELECT a.id, a.estado, a.fecha_hora, e.nombre_completo, e.codigo_estudiante
       FROM asistencias a JOIN estudiantes e ON e.id = a.estudiante_id
       WHERE a.sesion_id = $1 ORDER BY a.fecha_hora ASC`, [req.params.sesion_id]
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
      SELECT e.* FROM estudiantes e
      JOIN curso_estudiantes ce ON ce.estudiante_id = e.id
      WHERE ce.curso_id = $1 ORDER BY e.nombre_completo
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
  const { nombre_clase, fecha_programada } = req.body;
  try {
    const r = await pool.query(
      'INSERT INTO sesiones_clase (nombre_clase, token_qr, activa, curso_id, fecha_programada) VALUES ($1, $2, false, $3, $4) RETURNING *',
      [nombre_clase, 'scheduled', req.params.id, fecha_programada]
    );
    res.json({ sesion: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/sesiones/:id/activar  (start a scheduled session)
app.put('/api/sesiones/:id/activar', async (req, res) => {
  try {
    // Deactivate any other active session
    await pool.query('UPDATE sesiones_clase SET activa = false WHERE activa = true');
    const token = generateQrToken(req.params.id);
    const r = await pool.query(
      'UPDATE sesiones_clase SET activa = true, token_qr = $1, fecha_inicio = NOW() WHERE id = $2 RETURNING *',
      [token, req.params.id]
    );
    res.json({ sesion: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cursos/:id/historial  (attendance matrix filtered by course)
app.get('/api/cursos/:id/historial', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT a.id, a.estado, a.fecha_hora, a.sesion_id, a.estudiante_id, 
             e.nombre_completo, e.codigo_estudiante, s.nombre_clase
      FROM asistencias a
      JOIN estudiantes e ON e.id = a.estudiante_id
      JOIN sesiones_clase s ON s.id = a.sesion_id
      WHERE s.curso_id = $1
      ORDER BY a.fecha_hora DESC
    `, [req.params.id]);
    res.json({ historial: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default app;
