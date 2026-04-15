import { useState, useEffect, useMemo } from 'react';
import { Plus, StopCircle, LogOut, ClipboardList, Users, History, Radio, Settings, BookOpen, Calendar, Trash2, Play, UserPlus, X } from 'lucide-react';
import { api } from '../api/client';
import { toast } from '../components/Toast';
import QrGenerator from '../components/QrGenerator';
import AttendanceTable from '../components/AttendanceTable';

export default function TeacherPage({ user, onLogout }) {
  // ── Course-level state ──────────────────────────────────
  const [cursos, setCursos]             = useState([]);
  const [cursoActivo, setCursoActivo]   = useState(null);
  const [showNewCurso, setShowNewCurso] = useState(false);
  const [newCursoName, setNewCursoName] = useState('');

  // ── Tab state ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('vivo'); // vivo | alumnos | clases | historial | config

  // ── Live session ────────────────────────────────────────
  const [sesion, setSesion]         = useState(null);
  const [nombreClase, setNombre]    = useState('');
  const [loading, setLoading]       = useState(false);
  const [asistencias, setAsistencias] = useState([]);
  const [checking, setChecking]     = useState(true);

  // ── Data per tab ────────────────────────────────────────
  const [estudiantesCurso, setEstudiantesCurso] = useState([]);
  const [todosEstudiantes, setTodosEstudiantes] = useState([]);
  const [sesionesProgr, setSesionesProgr]       = useState([]);
  const [historialGen, setHistorialGen]         = useState([]);
  const [config, setConfig]                     = useState(null);

  // ── New class scheduling ────────────────────────────────
  const [newClaseName, setNewClaseName] = useState('');
  const [newClaseDate, setNewClaseDate] = useState('');

  // ── Init: load courses ──────────────────────────────────
  useEffect(() => {
    api.getCursos()
       .then(res => {
         setCursos(res.cursos);
         if (res.cursos.length > 0) setCursoActivo(res.cursos[0]);
       })
       .catch(() => {})
       .finally(() => setChecking(false));
  }, []);

  // ── Load active session ─────────────────────────────────
  useEffect(() => {
    api.getSesionActiva()
       .then(res => setSesion(res.sesion))
       .catch(() => {});
  }, []);

  // ── Fetch tab data when tab or course changes ───────────
  useEffect(() => {
    if (!cursoActivo) return;
    const id = cursoActivo.id;

    if (activeTab === 'alumnos') {
      Promise.all([
        api.getCursoEstudiantes(id),
        api.getEstudiantes()
      ]).then(([resC, resA]) => {
        setEstudiantesCurso(resC.estudiantes);
        setTodosEstudiantes(resA.estudiantes.filter(e => e.codigo_estudiante !== 'PROF01'));
      });
    } else if (activeTab === 'clases') {
      api.getCursoSesiones(id).then(res => setSesionesProgr(res.sesiones));
    } else if (activeTab === 'historial') {
      Promise.all([
        api.getCursoHistorial(id),
        api.getCursoEstudiantes(id)
      ]).then(([resH, resE]) => {
        setHistorialGen(resH.historial);
        setEstudiantesCurso(resE.estudiantes);
      });
    } else if (activeTab === 'config') {
      api.getConfiguracion().then(res => setConfig(res.config));
    }
  }, [activeTab, cursoActivo]);

  // ── Actions ─────────────────────────────────────────────
  const crearCurso = async (e) => {
    e.preventDefault();
    if (!newCursoName.trim()) return;
    try {
      const { curso } = await api.crearCurso({ nombre: newCursoName.trim() });
      setCursos(prev => [curso, ...prev]);
      setCursoActivo(curso);
      setNewCursoName('');
      setShowNewCurso(false);
      toast.success(`Curso "${curso.nombre}" creado`);
    } catch (err) { toast.error(err.message); }
  };

  const eliminarCurso = async (id) => {
    if (!confirm('¿Eliminar este curso y todas sus clases programadas?')) return;
    try {
      await api.deleteCurso(id);
      const updated = cursos.filter(c => c.id !== id);
      setCursos(updated);
      setCursoActivo(updated[0] || null);
      toast.info('Curso eliminado');
    } catch (err) { toast.error(err.message); }
  };

  const addAlumno = async (estudianteId) => {
    try {
      await api.addEstudianteCurso(cursoActivo.id, estudianteId);
      const res = await api.getCursoEstudiantes(cursoActivo.id);
      setEstudiantesCurso(res.estudiantes);
      toast.success('Alumno añadido al curso');
    } catch (err) { toast.error(err.message); }
  };

  const removeAlumno = async (estudianteId) => {
    try {
      await api.removeEstudianteCurso(cursoActivo.id, estudianteId);
      setEstudiantesCurso(prev => prev.filter(e => e.id !== estudianteId));
      toast.info('Alumno removido del curso');
    } catch (err) { toast.error(err.message); }
  };

  const programarClase = async (e) => {
    e.preventDefault();
    if (!newClaseName.trim() || !newClaseDate) return;
    try {
      await api.crearCursoSesion(cursoActivo.id, {
        nombre_clase: newClaseName.trim(),
        fecha_programada: newClaseDate
      });
      const res = await api.getCursoSesiones(cursoActivo.id);
      setSesionesProgr(res.sesiones);
      setNewClaseName('');
      setNewClaseDate('');
      toast.success('Clase programada');
    } catch (err) { toast.error(err.message); }
  };

  const activarSesion = async (sesionId) => {
    try {
      const { sesion: s } = await api.activarSesion(sesionId);
      setSesion(s);
      setActiveTab('vivo');
      toast.success('¡Sesión iniciada! QR activo.');
    } catch (err) { toast.error(err.message); }
  };

  const cerrarSesion = async () => {
    if (!sesion) return;
    if (!confirm('¿Cerrar la sesión actual?')) return;
    try {
      await api.cerrarSesion(sesion.id);
      setSesion(null);
      setAsistencias([]);
      toast.info('Sesión cerrada');
    } catch (err) { toast.error(err.message); }
  };

  const eliminarSesionProgramada = async (id) => {
    try {
      await api.cerrarSesion(id);
      setSesionesProgr(prev => prev.filter(s => s.id !== id));
      toast.info('Clase eliminada');
    } catch (err) { toast.error(err.message); }
  };

  const crearSesionLive = async (e) => {
    e.preventDefault();
    if (!nombreClase.trim()) return;
    setLoading(true);
    try {
      const { sesion: s } = await api.crearSesion(nombreClase.trim());
      setSesion(s);
      setAsistencias([]);
      toast.success(`Sesión "${s.nombre_clase}" iniciada`);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const updateAsistenciaEstado = async (id, estado) => {
    const ast = historialGen.find(a => a.id === id);
    if (!ast || ast.estado === estado) return;
    try {
      await api.updateAsistencia(id, { estado });
      setHistorialGen(prev => prev.map(a => a.id === id ? { ...a, estado } : a));
      toast.success('Estado actualizado');
    } catch { toast.error('Error al actualizar estado'); }
  };

  const createAsistenciaManual = async (estudiante_id, sesion_id, estado) => {
    try {
      await api.crearAsistenciaManual({ estudiante_id, sesion_id, estado });
      const res = await api.getCursoHistorial(cursoActivo.id);
      setHistorialGen(res.historial);
      toast.success('Asistencia registrada');
    } catch { toast.error('Error al registrar asistencia'); }
  };

  const updateConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateConfiguracion(config);
      toast.success('Ajustes de horario actualizados');
    } catch { toast.error('Error actualizando configuraciones'); }
    finally { setLoading(false); }
  };

  const updateEstudiante = async (id, field, value) => {
    const est = estudiantesCurso.find(e => e.id === id);
    if (!est || est[field] === value) return;
    const payload = { ...est, [field]: value };
    try {
      await api.updateEstudiante(id, payload);
      setEstudiantesCurso(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
      toast.success('Alumno actualizado');
    } catch { toast.error('Error al actualizar alumno'); }
  };

  // ── Derived data for matrix ─────────────────────────────
  const clasesColumns = useMemo(() => {
    const clsMap = new Map();
    historialGen.forEach(a => {
      const dt = new Date(a.fecha_hora);
      clsMap.set(a.sesion_id, {
        id: a.sesion_id, name: a.nombre_clase, dt: dt.getTime(),
        label: dt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
      });
    });
    return Array.from(clsMap.values()).sort((a, b) => a.dt - b.dt);
  }, [historialGen]);

  const alumnosNoInscritos = useMemo(() => {
    const ids = new Set(estudiantesCurso.map(e => e.id));
    return todosEstudiantes.filter(e => !ids.has(e.id));
  }, [todosEstudiantes, estudiantesCurso]);

  // ── Helpers ─────────────────────────────────────────────
  const fmtFecha = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    return `${date.toLocaleDateString('es-MX')} ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (checking) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderTopColor: 'var(--primary)', width: 32, height: 32 }} />
      </div>
    );
  }

  const COLORS = { Puntual: '#10b981', Presente: '#3b82f6', Tarde: '#f97316', Justificado: '#86efac', Falto: '#ef4444' };
  const SHORTS = { Puntual: 'P', Presente: 'Pr', Tarde: 'T', Justificado: 'J', Falto: 'F' };

  return (
    <div className="app-shell" style={{ maxWidth: '100%', width: '100%', padding: '0 1rem' }}>
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ClipboardList size={20} />
          <div>
            <div style={{ padding: 0, display: 'flex', alignItems: 'center' }}><h1>Panel Docente</h1></div>
            <div className="subtitle">{user.nombre_completo}</div>
          </div>
        </div>
        <button onClick={onLogout} className="btn btn-sm btn-ghost" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }}>
          <LogOut size={14} /> Salir
        </button>
      </div>

      {/* Course Selector Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
        background: 'white', borderRadius: '8px', marginBottom: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        flexWrap: 'wrap'
      }}>
        <BookOpen size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <select
          value={cursoActivo?.id || ''}
          onChange={e => {
            const c = cursos.find(c => c.id === Number(e.target.value));
            setCursoActivo(c);
          }}
          style={{
            flex: 1, minWidth: '150px', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid var(--gray-200)', fontSize: '0.9rem', fontWeight: '600'
          }}
        >
          {cursos.length === 0 && <option value="">Sin cursos — crea uno</option>}
          {cursos.map(c => (
            <option key={c.id} value={c.id}>{c.nombre} ({c.total_alumnos} alumnos, {c.total_clases} clases)</option>
          ))}
        </select>

        {!showNewCurso ? (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewCurso(true)} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Nuevo Curso
          </button>
        ) : (
          <form onSubmit={crearCurso} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text" placeholder="Nombre del curso" autoFocus value={newCursoName}
              onChange={e => setNewCursoName(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.85rem' }}
            />
            <button className="btn btn-primary btn-sm" type="submit">Crear</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowNewCurso(false)}><X size={14} /></button>
          </form>
        )}

        {cursoActivo && (
          <button className="btn btn-sm btn-ghost" onClick={() => eliminarCurso(cursoActivo.id)}
            style={{ color: 'var(--danger)', padding: '4px 8px' }} title="Eliminar curso">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Tabs */}
      {cursoActivo && (
        <>
          <div className="tabs" style={{ flexWrap: 'wrap' }}>
            <button className={`tab ${activeTab === 'vivo' ? 'active' : ''}`} onClick={() => setActiveTab('vivo')}>
              <Radio size={16} /> Monitor
            </button>
            <button className={`tab ${activeTab === 'alumnos' ? 'active' : ''}`} onClick={() => setActiveTab('alumnos')}>
              <Users size={16} /> Alumnos
            </button>
            <button className={`tab ${activeTab === 'clases' ? 'active' : ''}`} onClick={() => setActiveTab('clases')}>
              <Calendar size={16} /> Clases
            </button>
            <button className={`tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
              <History size={16} /> Historial
            </button>
            <button className={`tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
              <Settings size={16} /> Ajustes
            </button>
          </div>

          <div className="page-body" style={{ width: '100%' }}>

            {/* ─── MONITOR EN VIVO ─────────────────────── */}
            {activeTab === 'vivo' && (
              !sesion ? (
                <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
                  <div className="card-title"><Plus size={18} /> Nueva Sesión Rápida</div>
                  <div className="card-subtitle">Inicia una sesión de clase en vivo con código QR para {cursoActivo.nombre}.</div>
                  <form onSubmit={crearSesionLive}>
                    <div className="form-group">
                      <label className="form-label">Nombre de la clase</label>
                      <input className="form-input" type="text" autoFocus value={nombreClase}
                        onChange={e => setNombre(e.target.value)} placeholder="Ej: Sesión 5 - Regresión" />
                    </div>
                    <div style={{ marginTop: '1.5rem' }}>
                      <button className="btn btn-primary" type="submit" disabled={loading || !nombreClase.trim()}>
                        {loading ? <div className="spinner" /> : <><Plus size={16} /> Iniciar Sesión Live</>}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 350px) 1fr', gap: '1rem', alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="session-chip" style={{ width: '100%', justifyContent: 'space-between', padding: '0.5rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="live-dot" /> <strong>{sesion.nombre_clase}</strong>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={cerrarSesion} style={{ padding: '4px 8px' }}>
                        <StopCircle size={13} /> Terminar
                      </button>
                    </div>
                    <div className="card" style={{ margin: 0, display: 'flex', justifyContent: 'center' }}>
                      <QrGenerator sesion={sesion} />
                    </div>
                  </div>
                  <div className="card" style={{ margin: 0 }}>
                    <AttendanceTable sesionId={sesion.id} asistencias={asistencias} setAsistencias={setAsistencias} />
                  </div>
                </div>
              )
            )}

            {/* ─── ALUMNOS DEL CURSO ──────────────────── */}
            {activeTab === 'alumnos' && (
              <div className="card">
                <div className="card-title">Alumnos de {cursoActivo.nombre}</div>
                <div className="card-subtitle">{estudiantesCurso.length} inscritos. Añade o remueve alumnos de este curso.</div>

                {/* Add student dropdown */}
                {alumnosNoInscritos.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '1rem 0', padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <UserPlus size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <select id="add-student-select" style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.85rem' }}>
                      {alumnosNoInscritos.map(e => <option key={e.id} value={e.id}>{e.nombre_completo} ({e.codigo_estudiante})</option>)}
                    </select>
                    <button className="btn btn-sm btn-primary" onClick={() => {
                      const sel = document.getElementById('add-student-select');
                      if (sel) addAlumno(Number(sel.value));
                    }}>Añadir</button>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {estudiantesCurso.map(est => (
                    <div key={est.id} className="editable-row">
                      <input type="text" defaultValue={est.nombre_completo}
                        onBlur={(e) => updateEstudiante(est.id, 'nombre_completo', e.target.value)} placeholder="Nombre" />
                      <input type="text" defaultValue={est.codigo_estudiante}
                        onBlur={(e) => updateEstudiante(est.id, 'codigo_estudiante', e.target.value)} placeholder="CUI" />
                      <button className="btn btn-sm btn-ghost" onClick={() => removeAlumno(est.id)}
                        style={{ color: '#ef4444' }} title="Quitar del curso">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── CLASES PROGRAMADAS ─────────────────── */}
            {activeTab === 'clases' && (
              <div className="card">
                <div className="card-title"><Calendar size={18} /> Clases de {cursoActivo.nombre}</div>
                <div className="card-subtitle">Programa las fechas de tus clases. Puedes iniciar la sesión QR desde aquí.</div>

                {/* Schedule form */}
                <form onSubmit={programarClase} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', margin: '1rem 0', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                    <label className="form-label">Nombre</label>
                    <input className="form-input" type="text" value={newClaseName}
                      onChange={e => setNewClaseName(e.target.value)} placeholder="Ej: Clase 6 - Hipótesis" />
                  </div>
                  <div className="form-group" style={{ minWidth: '180px' }}>
                    <label className="form-label">Fecha y Hora</label>
                    <input className="form-input" type="datetime-local" value={newClaseDate}
                      onChange={e => setNewClaseDate(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={!newClaseName.trim() || !newClaseDate}
                    style={{ marginBottom: '0.25rem' }}>
                    <Plus size={14} /> Programar
                  </button>
                </form>

                {/* Session list */}
                {sesionesProgr.length === 0 ? (
                  <p className="text-muted">No hay clases programadas aún.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {sesionesProgr.map(s => (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                        padding: '0.75rem 1rem', background: s.activa ? '#ecfdf5' : '#f9fafb',
                        borderRadius: '8px', border: `1px solid ${s.activa ? '#86efac' : '#e5e7eb'}`
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{s.nombre_clase}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                            {s.fecha_programada ? fmtFecha(s.fecha_programada) : fmtFecha(s.fecha_inicio)}
                            {s.total_asistencias > 0 && ` • ${s.total_asistencias} registros`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {s.activa ? (
                            <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>EN VIVO</span>
                          ) : (
                            <button className="btn btn-sm btn-primary" onClick={() => activarSesion(s.id)}>
                              <Play size={12} /> Iniciar
                            </button>
                          )}
                          <button className="btn btn-sm btn-ghost" onClick={() => eliminarSesionProgramada(s.id)}
                            style={{ color: '#ef4444', padding: '4px' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── HISTORIAL / MATRIZ ─────────────────── */}
            {activeTab === 'historial' && (
              <div className="card" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                <div className="card-title">Matriz de Asistencias — {cursoActivo.nombre}</div>
                <div className="card-subtitle">Vista acumulada estilo hoja de cálculo. Clic en la celda para cambiar estado.</div>

                {historialGen.length === 0 ? <p className="text-muted" style={{ marginTop: '1rem' }}>No hay clases o registros aún para este curso.</p> : (
                  <div style={{ overflowX: 'auto', marginTop: '1rem', border: '1px solid var(--gray-200)', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'center' }}>
                      <thead>
                        <tr style={{ background: 'var(--gray-50)' }}>
                          <th style={{
                            padding: '10px 12px', borderBottom: '2px solid var(--gray-200)', textAlign: 'left',
                            minWidth: '180px', position: 'sticky', left: 0, background: 'var(--gray-50)', zIndex: 2
                          }}>Estudiante</th>
                          {clasesColumns.map(c => (
                            <th key={c.id} style={{ padding: '8px 4px', borderBottom: '2px solid var(--gray-200)', minWidth: '50px' }}>
                              <div style={{ fontSize: '0.72rem', color: 'var(--primary)', lineHeight: 1.2 }}>{c.label}</div>
                            </th>
                          ))}
                          <th style={{
                            padding: '10px 8px', borderBottom: '2px solid var(--gray-200)',
                            background: '#eff6ff', color: '#2563eb', position: 'sticky', right: 0, zIndex: 2, minWidth: '50px'
                          }}>Punt.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estudiantesCurso.map((est, i) => {
                          const recs = historialGen.filter(h => h.estudiante_id === est.id);
                          const points = recs.filter(h => h.estado === 'Puntual' || h.estado === 'Presente').length;
                          return (
                            <tr key={est.id} style={{ borderBottom: '1px solid var(--gray-100)', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{
                                padding: '6px 10px', textAlign: 'left',
                                position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '500', color: 'var(--gray-800)', fontSize: '0.78rem' }}>{est.nombre_completo}</span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>{est.codigo_estudiante}</span>
                                </div>
                              </td>
                              {clasesColumns.map(c => {
                                const r = recs.find(h => h.sesion_id === c.id);
                                const status = r ? r.estado : '';
                                return (
                                  <td key={c.id} style={{ padding: 0, borderLeft: '1px solid var(--gray-100)' }}>
                                    <select
                                      value={status}
                                      onChange={(e) => {
                                        if (!e.target.value) return;
                                        if (r) updateAsistenciaEstado(r.id, e.target.value);
                                        else createAsistenciaManual(est.id, c.id, e.target.value);
                                      }}
                                      style={{
                                        width: '100%', height: '34px', appearance: 'none', border: 'none', background: 'transparent',
                                        textAlign: 'center', cursor: 'pointer', outline: 'none',
                                        fontWeight: '800', fontSize: '0.85rem', color: status ? COLORS[status] : 'var(--gray-300)'
                                      }}
                                    >
                                      <option value="" disabled>—</option>
                                      {Object.keys(SHORTS).map(k => (
                                        <option key={k} value={k} style={{ color: COLORS[k], fontWeight: 'bold' }}>{SHORTS[k]}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              })}
                              <td style={{
                                padding: '6px', fontWeight: 'bold', borderLeft: '2px solid var(--gray-200)',
                                background: '#eff6ff', position: 'sticky', right: 0, zIndex: 1
                              }}>{points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{ padding: '10px 12px', fontSize: '0.72rem', color: 'var(--gray-500)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span><strong style={{ color: '#10b981' }}>P</strong>=Puntual</span>
                      <span><strong style={{ color: '#3b82f6' }}>Pr</strong>=Presente</span>
                      <span><strong style={{ color: '#f97316' }}>T</strong>=Tarde</span>
                      <span><strong style={{ color: '#86efac' }}>J</strong>=Justificado</span>
                      <span><strong style={{ color: '#ef4444' }}>F</strong>=Falto</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── CONFIGURACIÓN ──────────────────────── */}
            {activeTab === 'config' && config && (
              <div className="card" style={{ maxWidth: 520 }}>
                <div className="card-title">Ajustes de Horario Dinámico</div>
                <div className="card-subtitle">Define las horas límite para la marcación automática (formato 24H).</div>
                <form onSubmit={updateConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--success)' }}>Hora límite — PUNTUAL</label>
                    <input className="form-input" type="time" required value={config.limite_puntual}
                      onChange={e => setConfig({ ...config, limite_puntual: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--info)' }}>Hora límite — PRESENTE</label>
                    <input className="form-input" type="time" required value={config.limite_presente}
                      onChange={e => setConfig({ ...config, limite_presente: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--warning)' }}>Hora límite — TARDE</label>
                    <input className="form-input" type="time" required value={config.limite_tarde}
                      onChange={e => setConfig({ ...config, limite_tarde: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px' }}
                    onClick={() => setConfig({ ...config, permitir_falto: !config.permitir_falto })}>
                    <input type="checkbox" checked={config.permitir_falto} readOnly style={{ cursor: 'pointer' }} />
                    <span>Permitir marcar INASISTENCIA (Falto) desde el móvil después del límite.</span>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? <div className="spinner" /> : 'Guardar Ajustes'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </>
      )}

      {/* No course selected message */}
      {!cursoActivo && !checking && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--gray-500)' }}>
          <BookOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>Crea tu primer curso para comenzar a gestionar asistencias.</p>
        </div>
      )}
    </div>
  );
}
