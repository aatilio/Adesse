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
const generateQrToken = (sesionId) =>
  jwt.sign({ sesionId, iat: Math.floor(Date.now() / 1000) }, QR_SECRET, { expiresIn: QR_EXPIRY_SECONDS });

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
    const token = generateQrToken('temp');
    const r = await pool.query(
      'INSERT INTO sesiones_clase (nombre_clase, token_qr, activa) VALUES ($1, $2, true) RETURNING *',
      [nombre_clase, token]
    );
    const sesion = r.rows[0];
    const finalToken = generateQrToken(sesion.id);
    const updated = await pool.query('UPDATE sesiones_clase SET token_qr = $1 WHERE id = $2 RETURNING *', [finalToken, sesion.id]);
    res.json({ sesion: updated.rows[0] });
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
    let decoded;
    try { decoded = jwt.verify(token_qr, QR_SECRET); }
    catch { return res.status(401).json({ error: 'QR inválido o expirado' }); }

    const sesion = await pool.query('SELECT * FROM sesiones_clase WHERE id = $1 AND activa = true', [decoded.sesionId]);
    if (sesion.rows.length === 0) return res.status(400).json({ error: 'Sesión no activa' });

    const existe = await pool.query('SELECT id FROM asistencias WHERE estudiante_id = $1 AND sesion_id = $2', [estudiante_id, decoded.sesionId]);
    if (existe.rows.length > 0) return res.status(409).json({ error: 'Asistencia ya registrada' });

    const r = await pool.query(
      'INSERT INTO asistencias (estudiante_id, sesion_id, estado) VALUES ($1, $2, $3) RETURNING *',
      [estudiante_id, decoded.sesionId, estado]
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
      `SELECT a.id, a.estado, a.fecha_hora, s.nombre_clase
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
      `SELECT a.id, a.estado, a.fecha_hora, e.nombre_completo, e.codigo_estudiante, s.nombre_clase
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

export default app;
