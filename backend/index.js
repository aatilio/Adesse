import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;
const QR_SECRET = process.env.QR_SECRET || 'sai-qr-super-secret-key-2024';
const QR_EXPIRY_SECONDS = 15;

app.use(cors());
app.use(express.json());

// ── Database Pool ─────────────────────────────────────────────
const pool = new Pool({
  user: process.env.DB_USER || 'root',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'asistenciadb',
  password: process.env.DB_PASSWORD || 'rootpassword',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Retry DB connection on startup (wait for postgres container to be ready)
const connectWithRetry = async (retries = 10, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ Conectado a PostgreSQL');
      client.release();
      return;
    } catch (err) {
      console.log(`⏳ Esperando base de datos... intento ${i + 1}/${retries}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  console.error('❌ No se pudo conectar a la base de datos');
};

await connectWithRetry();

// ── Helpers ───────────────────────────────────────────────────
const generateQrToken = (sesionId) => {
  return jwt.sign(
    { sesionId, iat: Math.floor(Date.now() / 1000) },
    QR_SECRET,
    { expiresIn: QR_EXPIRY_SECONDS }
  );
};

// ── ROUTES ────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// POST /api/auth/login — Identificar alumno por código
app.post('/api/auth/login', async (req, res) => {
  const { codigo_estudiante } = req.body;
  if (!codigo_estudiante) return res.status(400).json({ error: 'Código requerido' });

  try {
    const result = await pool.query(
      'SELECT id, codigo_estudiante, nombre_completo FROM estudiantes WHERE codigo_estudiante = $1',
      [codigo_estudiante.trim().toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Código de estudiante no encontrado' });
    }
    res.json({ estudiante: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/sesiones/activa — Obtener sesión activa
app.get('/api/sesiones/activa', async (_, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sesiones_clase WHERE activa = TRUE ORDER BY created_at DESC LIMIT 1'
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hay sesión activa' });
    }
    res.json({ sesion: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sesiones — Crear y activar una nueva sesión (Profesor)
app.post('/api/sesiones', async (req, res) => {
  const { nombre_clase } = req.body;
  if (!nombre_clase) return res.status(400).json({ error: 'Nombre de clase requerido' });

  try {
    // Desactivar sesiones anteriores
    await pool.query('UPDATE sesiones_clase SET activa = FALSE');

    const sesionResult = await pool.query(
      'INSERT INTO sesiones_clase (nombre_clase, activa) VALUES ($1, TRUE) RETURNING *',
      [nombre_clase]
    );
    const sesion = sesionResult.rows[0];

    // Generar primer token QR
    const token = generateQrToken(sesion.id);
    const expira = new Date(Date.now() + QR_EXPIRY_SECONDS * 1000);
    await pool.query(
      'UPDATE sesiones_clase SET token_qr = $1, token_expira_en = $2 WHERE id = $3',
      [token, expira, sesion.id]
    );

    res.status(201).json({ sesion: { ...sesion, token_qr: token } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear sesión' });
  }
});

// PUT /api/sesiones/:id/token — Refrescar token QR
app.put('/api/sesiones/:id/token', async (req, res) => {
  const { id } = req.params;
  try {
    const token = generateQrToken(id);
    const expira = new Date(Date.now() + QR_EXPIRY_SECONDS * 1000);
    await pool.query(
      'UPDATE sesiones_clase SET token_qr = $1, token_expira_en = $2 WHERE id = $3 RETURNING *',
      [token, expira, id]
    );
    res.json({ token, expira_en: expira });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al refrescar token' });
  }
});

// DELETE /api/sesiones/:id — Desactivar sesión
app.delete('/api/sesiones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE sesiones_clase SET activa = FALSE WHERE id = $1', [id]);
    res.json({ message: 'Sesión cerrada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

// POST /api/asistencias — Registrar asistencia
app.post('/api/asistencias', async (req, res) => {
  const { token_qr, estudiante_id, estado } = req.body;
  if (!token_qr || !estudiante_id || !estado) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    // 1. Verificar y decodificar el token QR
    let decoded;
    try {
      decoded = jwt.verify(token_qr, QR_SECRET);
    } catch {
      return res.status(401).json({ error: 'Código QR expirado o inválido. Escanea el nuevo.' });
    }

    const sesionId = decoded.sesionId;

    // 2. Verificar que la sesión exista y esté activa
    const sesionResult = await pool.query(
      'SELECT * FROM sesiones_clase WHERE id = $1 AND activa = TRUE',
      [sesionId]
    );
    if (sesionResult.rows.length === 0) {
      return res.status(404).json({ error: 'La sesión no está activa' });
    }

    // 3. Insertar asistencia (la constraint UNIQUE evita duplicados)
    const result = await pool.query(
      `INSERT INTO asistencias (estudiante_id, sesion_id, estado)
       VALUES ($1, $2, $3) RETURNING *`,
      [estudiante_id, sesionId, estado]
    );

    res.status(201).json({ asistencia: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya registraste tu asistencia en esta sesión' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/asistencias/:sesion_id — Listar asistencias de una sesión
app.get('/api/asistencias/:sesion_id', async (req, res) => {
  const { sesion_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT a.id, a.estado, a.fecha_hora,
              e.nombre_completo, e.codigo_estudiante
       FROM asistencias a
       JOIN estudiantes e ON e.id = a.estudiante_id
       WHERE a.sesion_id = $1
       ORDER BY a.fecha_hora DESC`,
      [sesion_id]
    );
    res.json({ asistencias: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener asistencias' });
  }
});

// GET /api/estudiantes — Listar todos los estudiantes
app.get('/api/estudiantes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estudiantes ORDER BY nombre_completo');
    res.json({ estudiantes: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// PUT /api/estudiantes/:id — Editar un estudiante
app.put('/api/estudiantes/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo_estudiante, nombre_completo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE estudiantes SET codigo_estudiante = $1, nombre_completo = $2 WHERE id = $3 RETURNING *',
      [codigo_estudiante, nombre_completo, id]
    );
    res.json({ estudiante: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estudiante' });
  }
});

// PUT /api/asistencias/:id — Editar estado de asistencia
app.put('/api/asistencias/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const result = await pool.query(
      'UPDATE asistencias SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    res.json({ asistencia: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar asistencia' });
  }
});

// GET /api/asistencias/alumno/:id — Historial de un alumno
app.get('/api/asistencias/alumno/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT a.id, a.estado, a.fecha_hora, s.nombre_clase 
       FROM asistencias a 
       JOIN sesiones_clase s ON a.sesion_id = s.id 
       WHERE a.estudiante_id = $1 
       ORDER BY a.fecha_hora DESC`, [id]
    );
    res.json({ historial: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /api/asistencias/historial — Historial global
app.get('/api/asistencias/historial', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.estado, a.fecha_hora, e.nombre_completo, e.codigo_estudiante, s.nombre_clase
       FROM asistencias a
       JOIN estudiantes e ON e.id = a.estudiante_id
       JOIN sesiones_clase s ON s.id = a.sesion_id
       ORDER BY a.fecha_hora DESC`
    );
    res.json({ historial: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial general' });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 API SAI corriendo en http://localhost:${PORT}`);
});
