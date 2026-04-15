import { useState, useEffect } from 'react';
import { Plus, StopCircle, LogOut, ClipboardList, Users, History, Radio } from 'lucide-react';
import { api } from '../api/client';
import { toast } from '../components/Toast';
import QrGenerator from '../components/QrGenerator';
import AttendanceTable from '../components/AttendanceTable';

export default function TeacherPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('vivo'); // vivo | alumnos | historial
  const [sesion, setSesion]         = useState(null);
  const [nombreClase, setNombre]    = useState('');
  const [loading, setLoading]       = useState(false);
  const [asistencias, setAsistencias] = useState([]);
  const [checking, setChecking]     = useState(true);

  // Data for tabs
  const [estudiantes, setEstudiantes] = useState([]);
  const [historialGen, setHistorialGen] = useState([]);

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
      api.getHistorialGeneral().then(res => setHistorialGen(res.historial));
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
      toast.success('Estado actualizado correctamente');
    } catch {
      toast.error('Error al actualizar estado');
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

        {/* VIEW: HISTORIAL */}
        {activeTab === 'historial' && (
           <div className="card">
             <div className="card-title">Registro Histórico Completo</div>
             <div className="card-subtitle">Revisa las clases pasadas y corrige los estados (Ej. Cambiar Falta Injustificada a Justificado).</div>

             {historialGen.length === 0 ? <p className="text-muted">No hay registros históricos.</p> : (
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {historialGen.map(ast => (
                    <div key={ast.id} className="editable-row" style={{ gridTemplateColumns: 'minmax(150px,2fr) 1.5fr 1fr' }}>
                      <div style={{ display:'flex', flexDirection:'column' }}>
                        <strong style={{ fontSize: 'var(--text-sm)' }}>{ast.nombre_completo}</strong>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{ast.nombre_clase} • {fmtFecha(ast.fecha_hora)}</span>
                      </div>
                      <select 
                        defaultValue={ast.estado} 
                        onChange={(e) => updateAsistenciaEstado(ast.id, e.target.value)}
                        style={{ fontWeight: '600' }}
                      >
                        <option value="Puntual">Puntual</option>
                        <option value="Presente">Presente</option>
                        <option value="Tarde">Tarde</option>
                        <option value="Justificado">Justificado</option>
                        <option value="Falto">Falto (Manual)</option>
                      </select>
                      <div>
                        {/* Empty right column for balance */}
                      </div>
                    </div>
                 ))}
               </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}
