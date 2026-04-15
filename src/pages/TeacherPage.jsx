import { useState, useEffect } from 'react';
import { Plus, StopCircle, LogOut, ClipboardList, Users, History, Radio, Settings } from 'lucide-react';

import { api } from '../api/client';
import { toast } from '../components/Toast';
import QrGenerator from '../components/QrGenerator';
import AttendanceTable from '../components/AttendanceTable';

export default function TeacherPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('vivo'); // vivo | alumnos | historial | config
  const [sesion, setSesion]         = useState(null);
  const [nombreClase, setNombre]    = useState('');
  const [loading, setLoading]       = useState(false);
  const [asistencias, setAsistencias] = useState([]);
  const [checking, setChecking]     = useState(true);

  // Data for tabs
  const [estudiantes, setEstudiantes] = useState([]);
  const [historialGen, setHistorialGen] = useState([]);
  const [config, setConfig] = useState(null);

  // Init
  useEffect(() => {
    api.getSesionActiva()
       .then(res => setSesion(res.sesion))
       .catch(() => {})
       .finally(() => setChecking(false));
  }, []);

  // Fetch when switching tabs
  useEffect(() => {
    if (activeTab === 'alumnos') {
      api.getEstudiantes().then(res => setEstudiantes(res.estudiantes));
    } else if (activeTab === 'historial') {
      // Necesitamos la lista de todos los estudiantes para la matriz
      Promise.all([api.getHistorialGeneral(), api.getEstudiantes()]).then(([resH, resE]) => {
         setHistorialGen(resH.historial);
         setEstudiantes(resE.estudiantes);
      });
    } else if (activeTab === 'config') {
      api.getConfiguracion().then(res => setConfig(res.config));
    }
  }, [activeTab]);

  const crearSesion = async (e) => {
    e.preventDefault();
    if (!nombreClase.trim()) return;
    setLoading(true);
    try {
      const { sesion: s } = await api.crearSesion(nombreClase.trim());
      setSesion(s);
      setAsistencias([]);
      toast.success(`Sesión "${s.nombre_clase}" iniciada`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cerrarSesion = async () => {
    if (!sesion) return;
    if (!confirm('¿Cerrar la sesión actual?')) return;
    try {
      await api.cerrarSesion(sesion.id);
      setSesion(null);
      setAsistencias([]);
      toast.info('Sesión cerrada');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Updaters
  const updateEstudiante = async (id, field, value) => {
    const est = estudiantes.find(e => e.id === id);
    if (!est || est[field] === value) return; // no change
    const payload = { ...est, [field]: value };
    try {
      await api.updateEstudiante(id, payload);
      setEstudiantes(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
      toast.success('Alumno actualizado');
    } catch {
      toast.error('Error al actualizar alumno');
    }
  };

  const updateAsistenciaEstado = async (id, estado) => {
    const ast = historialGen.find(a => a.id === id);
    if (!ast || ast.estado === estado) return;
    try {
      await api.updateAsistencia(id, { estado });
      setHistorialGen(prev => prev.map(a => a.id === id ? { ...a, estado } : a));
      toast.success('Estado actualizado');
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  const createAsistenciaManual = async (estudiante_id, sesion_id, estado) => {
    try {
      const { asistencia } = await api.crearAsistenciaManual({ estudiante_id, sesion_id, estado });
      // Reload historial to get the JOINed fields (like nombre_clase, etc)
      const res = await api.getHistorialGeneral();
      setHistorialGen(res.historial);
      toast.success('Asistencia registrada manualmente');
    } catch {
      toast.error('Error al registrar asistencia');
    }
  };

  const updateConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateConfiguracion(config);
      toast.success('Ajustes de horario actualizados');
    } catch {
      toast.error('Error actualizando configuraciones');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderTopColor: 'var(--primary)', width: 32, height: 32 }} />
      </div>
    );
  }

  const fmtFecha = (iso) => {
    const date = new Date(iso);
    return `${date.toLocaleDateString('es-MX')} ${date.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}`;
  };

  return (
    <div className="app-shell" style={{ maxWidth: '800px' }}>
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

      {/* Tabs Menu */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'vivo' ? 'active' : ''}`} onClick={() => setActiveTab('vivo')}>
          <Radio size={16} /> Monitor en Vivo
        </button>
        <button className={`tab ${activeTab === 'alumnos' ? 'active' : ''}`} onClick={() => setActiveTab('alumnos')}>
          <Users size={16} /> Base de Alumnos
        </button>
        <button className={`tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
          <History size={16} /> Historial General
        </button>
        <button className={`tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
          <Settings size={16} /> Ajustes de Hora
        </button>
      </div>

      <div className="page-body">
        {/* VIEW: EN VIVO */}
        {activeTab === 'vivo' && (
          !sesion ? (
            <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
              <div className="card-title"><Plus size={18} /> Nueva Sesión de Clase</div>
              <div className="card-subtitle">Genera un código QR dinámico.</div>
              <form onSubmit={crearSesion}>
                <div className="form-group">
                  <label className="form-label">Nombre de la clase / Sesión</label>
                  <input
                    className="form-input" type="text" autoFocus value={nombreClase}
                    onChange={e => setNombre(e.target.value)} placeholder="Ej: Prog. Web - Lunes"
                  />
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  <button className="btn btn-primary" type="submit" disabled={loading || !nombreClase.trim()}>
                    {loading ? <div className="spinner" /> : <><Plus size={16} /> Iniciar Sesión Live</>}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: '1rem', alignItems: 'start' }}>
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

        {/* VIEW: ALUMNOS */}
        {activeTab === 'alumnos' && (
          <div className="card">
            <div className="card-title">Directorio de Alumnos</div>
            <div className="card-subtitle">Puedes modificar el CUI o Nombre del alumno. Los cambios se guardan automáticamente al salir del recuadro.</div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {estudiantes.filter(e => e.codigo_estudiante !== 'PROF01').map(est => (
                <div key={est.id} className="editable-row">
                  <input 
                    type="text" 
                    defaultValue={est.nombre_completo} 
                    onBlur={(e) => updateEstudiante(est.id, 'nombre_completo', e.target.value)}
                    placeholder="Nombre del alumno"
                  />
                  <input 
                    type="text" 
                    defaultValue={est.codigo_estudiante} 
                    onBlur={(e) => updateEstudiante(est.id, 'codigo_estudiante', e.target.value)}
                    placeholder="CUI"
                  />
                  <div className="badge badge-justificado" style={{ opacity: 0.7 }}>Auto-Guardado</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: HISTORIAL (MATRIZ EXCEL) */}
        {activeTab === 'historial' && (
           <div className="card" style={{ maxWidth: '100%', overflow: 'hidden' }}>
             <div className="card-title">Matriz de Asistencias</div>
             <div className="card-subtitle">Vista acumulada. Escoge el estado de la celda para modificarlo (P=Puntual, Pr=Presente, T=Tarde, J=Justificado, F=Falgo).</div>

             {historialGen.length === 0 ? <p className="text-muted" style={{marginTop:'1rem'}}>No hay clases o registros aún.</p> : (
               <div style={{ overflowX: 'auto', marginTop: '1rem', border: '1px solid var(--gray-200)', borderRadius: '6px' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
                   <thead>
                     <tr style={{ background: 'var(--gray-50)' }}>
                       <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--gray-200)', textAlign: 'left', minWidth: '180px' }}>Estudiante</th>
                       {(() => {
                          const clsMap = new Map();
                          historialGen.forEach(a => {
                             const dt = new Date(a.fecha_hora);
                             clsMap.set(a.sesion_id, {
                               id: a.sesion_id, name: a.nombre_clase, dt: dt.getTime(),
                               label: dt.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit' })
                             });
                          });
                          const columns = Array.from(clsMap.values()).sort((a,b) => a.dt - b.dt);
                          window._clasesColumnsTemp = columns;
                          return columns.map(c => (
                            <th key={c.id} style={{ padding: '8px 4px', borderBottom: '2px solid var(--gray-200)', minWidth: '50px' }}>
                               <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{c.label}</div>
                            </th>
                          ));
                       })()}
                       <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--gray-200)', background: 'var(--blue-50)', color: 'var(--blue-600)' }}>Puntualidad</th>
                     </tr>
                   </thead>
                   <tbody>
                     {estudiantes.filter(e => e.codigo_estudiante !== 'PROF01').map((est, i) => {
                        const recs = historialGen.filter(h => h.estudiante_id === est.id);
                        const points = recs.filter(h => h.estado === 'Puntual' || h.estado === 'Presente').length;
                        
                        return (
                          <tr key={est.id} style={{ borderBottom: '1px solid var(--gray-100)', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                             <td style={{ padding: '8px 12px', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                               <span style={{ fontWeight: '500', color: 'var(--gray-800)', fontSize: '0.8rem' }}>{est.nombre_completo}</span>
                               <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{est.codigo_estudiante}</span>
                             </td>
                             {(window._clasesColumnsTemp || []).map(c => {
                                const r = recs.find(h => h.sesion_id === c.id);
                                const currentStatus = r ? r.estado : '';
                                const colors = { Puntual: '#10b981', Presente: '#3b82f6', Tarde: '#f97316', Justificado: '#86efac', Falto: '#ef4444' };
                                const shorts = { Puntual: 'P', Presente: 'Pr', Tarde: 'T', Justificado: 'J', Falto: 'F' };
                                
                                return (
                                  <td key={c.id} style={{ padding: 0, borderLeft: '1px solid var(--gray-100)' }}>
                                    <select
                                       value={currentStatus}
                                       onChange={(e) => {
                                          if (!e.target.value) return;
                                          if (r) updateAsistenciaEstado(r.id, e.target.value);
                                          else createAsistenciaManual(est.id, c.id, e.target.value);
                                       }}
                                       style={{
                                          width: '100%', height: '36px', appearance: 'none', border: 'none', background: 'transparent',
                                          textAlign: 'center', cursor: 'pointer', outline: 'none',
                                          fontWeight: '800', fontSize: '0.85rem', color: currentStatus ? colors[currentStatus] : 'var(--gray-300)'
                                       }}
                                    >
                                       <option value="" disabled>-</option>
                                       {Object.keys(shorts).map(k => <option key={k} value={k} style={{ color: colors[k], fontWeight: 'bold' }}>{shorts[k]}</option>)}
                                    </select>
                                  </td>
                                );
                             })}
                             <td style={{ padding: '8px', fontWeight: 'bold', borderLeft: '1px solid var(--gray-200)', background: 'var(--blue-50)' }}>{points}</td>
                          </tr>
                        );
                     })}
                   </tbody>
                 </table>
                 <div style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--gray-500)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span><strong style={{color:'#10b981'}}>P</strong>=Puntual</span>
                    <span><strong style={{color:'#3b82f6'}}>Pr</strong>=Presente</span>
                    <span><strong style={{color:'#f97316'}}>T</strong>=Tarde</span>
                    <span><strong style={{color:'#86efac'}}>J</strong>=Justificado</span>
                    <span><strong style={{color:'#ef4444'}}>F</strong>=Falto</span>
                 </div>
               </div>
             )}
           </div>
        )}

        {/* VIEW: CONFIG */}
        {activeTab === 'config' && config && (
          <div className="card">
            <div className="card-title">Ajustes de Horario Dinámico</div>
            <div className="card-subtitle">Define las horas límite para la marcación automática. Formato militar 24H (ej. 06:59).</div>
            <form onSubmit={updateConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--success)' }}>Hora límite para ingreso PUNTUAL</label>
                <input className="form-input" type="time" required value={config.limite_puntual} onChange={e => setConfig({ ...config, limite_puntual: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--info)' }}>Hora límite para ingreso PRESENTE</label>
                <input className="form-input" type="time" required value={config.limite_presente} onChange={e => setConfig({ ...config, limite_presente: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--warning)' }}>Hora límite para ingreso TARDE</label>
                <input className="form-input" type="time" required value={config.limite_tarde} onChange={e => setConfig({ ...config, limite_tarde: e.target.value })} />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px' }} onClick={() => setConfig({ ...config, permitir_falto: !config.permitir_falto })}>
                <input type="checkbox" checked={config.permitir_falto} readOnly style={{ cursor: 'pointer' }} />
                <span>Permitir a los alumnos marcar INASISTENCIA (Falto) desde el móvil luego de exceder todas las horas de ingreso.</span>
              </div>
              
              <button className="btn btn-primary mt-4" type="submit" disabled={loading}>
                {loading ? <div className="spinner" /> : 'Guardar Ajustes'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
