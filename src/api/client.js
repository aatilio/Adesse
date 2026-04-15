const API = import.meta.env.VITE_API_URL || '';

const request = async (method, path, body) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Error desconocido');
  return data;
};

export const api = {
  login:          (codigo_estudiante) => request('POST', '/api/auth/login', { codigo_estudiante }),
  getSesionActiva:() => request('GET', '/api/sesiones/activa'),
  crearSesion:    (nombre_clase)      => request('POST', '/api/sesiones', { nombre_clase }),
  cerrarSesion:   (id)               => request('DELETE', `/api/sesiones/${id}`),
  refrescarToken: (id)               => request('PUT', `/api/sesiones/${id}/token`),
  registrarAsistencia: (payload)     => request('POST', '/api/asistencias', payload),
  getAsistencias: (sesion_id)        => request('GET', `/api/asistencias/${sesion_id}`),
  
  getEstudiantes: ()                 => request('GET', '/api/estudiantes'),
  updateEstudiante: (id, payload)    => request('PUT', `/api/estudiantes/${id}`, payload),
  updateAsistencia: (id, payload)    => request('PUT', `/api/asistencias/${id}`, payload),
  getHistorialAlumno: (id)           => request('GET', `/api/asistencias/alumno/${id}`),
  getHistorialGeneral: ()            => request('GET', '/api/asistencias/historial'),
};

