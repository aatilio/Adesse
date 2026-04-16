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
  // Auth
  login:          (codigo) => request('POST', '/api/auth/login', { codigo }),

  // Sesiones
  getSesionActiva:() => request('GET', '/api/sesiones/activa'),
  crearSesion:    (nombre_clase, curso_id) => request('POST', '/api/sesiones', { nombre_clase, curso_id }),
  cerrarSesion:   (id)               => request('DELETE', `/api/sesiones/${id}`),
  terminarSesion: (id)               => request('PUT', `/api/sesiones/${id}/terminar`),
  updateSesion:   (id, payload)      => request('PUT', `/api/sesiones/${id}`, payload),
  refrescarToken: (id)               => request('PUT', `/api/sesiones/${id}/token`),
  activarSesion:  (id)               => request('PUT', `/api/sesiones/${id}/activar`),

  // Asistencias
  registrarAsistencia: (payload)     => request('POST', '/api/asistencias', payload),
  getAsistencias: (sesion_id)        => request('GET', `/api/asistencias/${sesion_id}`),
  updateAsistencia: (id, payload)    => request('PUT', `/api/asistencias/${id}`, payload),
  crearAsistenciaManual: (payload)   => request('POST', '/api/asistencias/manual', payload),
  getHistorialAlumno: (id)           => request('GET', `/api/asistencias/alumno/${id}`),
  getHistorialGeneral: ()            => request('GET', '/api/asistencias/historial'),

  // Estudiantes
  getEstudiantes: ()                 => request('GET', '/api/estudiantes'),
  updateEstudiante: (id, payload)    => request('PUT', `/api/estudiantes/${id}`, payload),
  getEstudianteCursos: (id)          => request('GET', `/api/estudiantes/${id}/cursos`),

  // Configuración
  getConfiguracion:    ()            => request('GET', '/api/configuracion'),
  updateConfiguracion: (datos)       => request('PUT', '/api/configuracion', datos),

  // Cursos
  getCursos:       ()                => request('GET', '/api/cursos'),
  crearCurso:      (datos)           => request('POST', '/api/cursos', datos),
  updateCurso:     (id, datos)       => request('PUT', `/api/cursos/${id}`, datos),
  deleteCurso:     (id)              => request('DELETE', `/api/cursos/${id}`),

  // Cursos → Estudiantes
  getCursoEstudiantes:    (cursoId)              => request('GET', `/api/cursos/${cursoId}/estudiantes`),
  addEstudianteCurso:     (cursoId, estudianteId)=> request('POST', `/api/cursos/${cursoId}/estudiantes`, { estudiante_id: estudianteId }),
  removeEstudianteCurso:  (cursoId, estudianteId)=> request('DELETE', `/api/cursos/${cursoId}/estudiantes/${estudianteId}`),

  // Cursos → Sesiones
  getCursoSesiones:       (cursoId)              => request('GET', `/api/cursos/${cursoId}/sesiones`),
  crearCursoSesion:       (cursoId, datos)       => request('POST', `/api/cursos/${cursoId}/sesiones`, datos),

  // Cursos → Historial
  getCursoHistorial:      (cursoId)              => request('GET', `/api/cursos/${cursoId}/historial`),
};
