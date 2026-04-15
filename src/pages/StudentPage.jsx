import { useState, useEffect, useRef } from 'react';
import { LogOut, QrCode, CheckCircle, ClipboardList, Clock, History, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../api/client';
import { toast } from '../components/Toast';

const ESTADOS = ['Puntual', 'Presente', 'Tarde', 'Justificado'];
const ESTADO_COLORS = {
  Puntual:     { bg: 'var(--success-bg)',     color: '#065f46' },
  Presente:    { bg: 'var(--info-bg)',         color: '#1e40af' },
  Tarde:       { bg: 'var(--warning-bg)',     color: '#92400e' },
  Justificado: { bg: 'var(--gray-100)',       color: 'var(--gray-600)' },
};

const STEPS = { SELECT: 'select', SCANNING: 'scanning', DONE: 'done' };

export default function StudentPage({ user, onLogout }) {
  const [viewMode, setViewMode]   = useState('dashboard'); // dashboard | curso
  const [cursos, setCursos]       = useState([]);
  const [cursoActivo, setCursoActivo] = useState(null);
  const [inputCode, setInputCode] = useState('');

  const [activeTab, setActiveTab] = useState('marcar'); // marcar | historial
  const [step, setStep]           = useState(STEPS.SELECT);
  const [estado, setEstado]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [registered, setRegistered] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [config, setConfig] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const scannerRef = useRef(null);

  // Time ticker
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Config & Cursos fetch
  useEffect(() => {
    api.getConfiguracion().then(res => setConfig(res.config)).catch(() => {});
    api.getEstudianteCursos(user.id).then(res => setCursos(res.cursos)).catch(() => {});
  }, [user.id]);

  // Determine valid statuses based on rules
  const getValidStatuses = () => {
    if (!config) return [];
    const currentHM = currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let valid = [];
    if (currentHM <= config.limite_puntual) {
      valid.push('Puntual');
    } else if (currentHM <= config.limite_presente) {
      valid.push('Presente');
    } else if (currentHM <= config.limite_tarde) {
      valid.push('Tarde');
    }

    // Permitir Falto luego de todos los márgenes siempre que esté activado
    if (config.permitir_falto && currentHM > config.limite_tarde) {
       valid.push('Falto');
    }

    return valid;
  };

  const validStatuses = getValidStatuses();
  // Auto-select valid status if there is exactly 1 valid option and we haven't selected one
  useEffect(() => {
    if (validStatuses.length > 0 && !validStatuses.includes(estado)) {
      setEstado(validStatuses[0]);
    } else if (validStatuses.length === 0) {
      setEstado('');
    }
  }, [validStatuses, estado]);



  // Fetch Historial
  useEffect(() => {
    if (activeTab === 'historial') {
      api.getHistorialAlumno(user.id)
         .then(res => setHistorial(res.historial))
         .catch(err => toast.error('Error cargando historial'));
    }
  }, [activeTab, user.id]);

  const startScanner = () => {
    if (!estado) {
      toast.error('Selecciona un estado de asistencia');
      return;
    }
    setStep(STEPS.SCANNING);
    setTimeout(() => initScanner(), 300);
  };

  const initScanner = () => {
    const el = document.getElementById('qr-reader');
    if (!el) return;

    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      handleQrScan,
      () => {}
    ).catch(() => {
      toast.error('No se pudo acceder a la cámara');
      setStep(STEPS.SELECT);
    });
  };

  const stopScanner = () => {
    scannerRef.current?.stop().catch(() => {});
    scannerRef.current = null;
    setStep(STEPS.SELECT);
  };

  const handleQrScan = async (decodedText) => {
    await stopScanner();
    setLoading(true);
    try {
      await api.registrarAsistencia({
        token_qr: decodedText,
        estudiante_id: user.id,
        estado,
      });
      const reg = { estado, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) };
      setRegistered(reg);
      setStep(STEPS.DONE);
      toast.success('¡Asistencia registrada!');
    } catch (err) {
      toast.error(err.message);
      setStep(STEPS.SELECT);
    } finally {
      setLoading(false);
    }
  };

  const fmtHora = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fmtFecha = (iso) => new Date(iso).toLocaleDateString('es-MX');

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ClipboardList size={20} />
          <div>
            <div className="page-header" style={{ padding: 0 }}>
              <h1>Mi Asistencia</h1>
            </div>
            <div className="subtitle">{user.nombre_completo}</div>
          </div>
        </div>
        <button onClick={onLogout} className="btn btn-sm btn-ghost" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }}>
          <LogOut size={14} /> Salir
        </button>
      </div>

      <div className="page-body" style={{ width: '100%', padding: '1rem' }}>
        {viewMode === 'dashboard' ? (
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--gray-800)' }}>Mis Cursos Matriculados</h2>
            
            {cursos.length === 0 ? (
              <div className="empty-state">No estás matriculado en ningún curso aún.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {cursos.map(c => (
                  <div key={c.id} className="card" onClick={() => { setCursoActivo(c); setViewMode('curso'); }} style={{ cursor: 'pointer' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                       <ClipboardList size={18} /> <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Curso</span>
                     </div>
                     <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--gray-800)' }}>{c.nombre}</h3>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => { setViewMode('dashboard'); setRegistered(null); setInputCode(''); }} style={{ padding: '6px 10px', background: 'white' }}>
                 « Volver
              </button>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--gray-800)' }}>{cursoActivo?.nombre}</h2>
            </div>

            <div className="tabs" style={{ margin: '0 -1rem 1rem -1rem' }}>
              <button className={`tab ${activeTab === 'marcar' ? 'active' : ''}`} onClick={() => setActiveTab('marcar')}>
                <CheckCircle size={16} /> Marcar Asistencia
              </button>
              <button className={`tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
                <History size={16} /> Historial
              </button>
            </div>

            {activeTab === 'historial' ? (
              <div>
             <h3 style={{ marginBottom: '1rem', fontSize: 'var(--text-md)', color: 'var(--gray-700)' }}>Historial de Asistencia</h3>
             {historial.filter(h => h.curso_id === cursoActivo.id).length === 0 ? <p className="text-muted text-center mt-4">No tienes asistencias registradas en este curso.</p> : (
               <div className="attendance-list">
                 {historial.filter(h => h.curso_id === cursoActivo.id).map(h => (
                    <div key={h.id} className="attendance-item">
                      <span className={`badge badge-${h.estado.toLowerCase()}`}>{h.estado}</span>
                      <div className="attendance-item-info" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '4px' }}>
                        <span className="attendance-item-name">{h.nombre_clase}</span>
                        <span className="attendance-item-time">{fmtFecha(h.fecha_hora)} - {fmtHora(h.fecha_hora)}</span>
                      </div>
                    </div>
                 ))}
               </div>
             )}
          </div>
        ) : (
          <>
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                <Clock size={18} style={{flexShrink:0}} />
                <div style={{fontSize:'0.75rem'}}>
                  <strong>Reglas de horario dinámico:</strong><br/>
                  Hasta {config?.limite_puntual}: Puntual<br/>
                  Hasta {config?.limite_presente}: Presente<br/>
                  Hasta {config?.limite_tarde}: Tarde<br/>
                  Hora actual: <strong>{currentTime.toLocaleTimeString('es-MX')}</strong>
                </div>
            </div>

            {registered && (
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
                  <CheckCircle size={56} color="var(--success)" strokeWidth={1.5} />
                  <div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--gray-800)' }}>Registro Completo</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginTop: 4 }}>Tu registro fue guardado a las {registered.hora}</div>
                  </div>
                  <span className={`badge badge-${registered.estado.toLowerCase()}`} style={{ fontSize: 'var(--text-base)' }}>
                    {registered.estado}
                  </span>
                </div>
              </div>
            )}

            {!registered && (
              <>
                <div className="card">
                  <div className="card-title">1. ¿Cómo llegas a clase hoy?</div>
                  <div className="card-subtitle">El sistema bloquea opciones según la hora actual</div>
                  
                  {validStatuses.length === 0 ? (
                    <div className="alert alert-error">
                      <strong>Falta automática:</strong> Has excedido de límite ({config?.limite_tarde}).
                    </div>
                  ) : (
                    <div className="status-grid">
                      {ESTADOS.concat(['Falto']).map(e => {
                        const isAutoEnabled = validStatuses.includes(e);
                        // don't render states we shouldn't
                        if (!isAutoEnabled && e === 'Falto') return null;

                        return (
                          <button
                            key={e} type="button"
                            disabled={!isAutoEnabled}
                            className={`status-option${estado === e ? ' selected' : ''}`}
                            onClick={() => setEstado(e)}
                            style={estado === e 
                              ? { borderColor: ESTADO_COLORS[e]?.color || '#dc2626', background: ESTADO_COLORS[e]?.bg || '#ffe4e6', color: ESTADO_COLORS[e]?.color || '#991b1b' } 
                              : (!isAutoEnabled ? { opacity: 0.4, cursor: 'not-allowed', background: '#f0f0f0' } : {})}
                          >
                            {e}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                  {validStatuses.length > 0 && (
                  <div className="card mt-4">
                    <div className="card-title">2. Ingresa Código o Escanea</div>
                    {step === STEPS.SCANNING ? (
                      <div>
                        <div id="qr-reader" ref={scannerRef} style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }} />
                        <button className="btn btn-ghost mt-4" onClick={stopScanner}>Cancelar</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                        
                        <div>
                          <input 
                            placeholder="Ej. A1B2C3" 
                            className="form-input" 
                            value={inputCode} 
                            onChange={e => setInputCode(e.target.value.toUpperCase())}
                            style={{ textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}
                            maxLength={6}
                          />
                        </div>
                        <button className="btn btn-primary" onClick={() => handleQrScan(inputCode)} disabled={loading || !estado || inputCode.length !== 6}>
                          {loading ? <div className="spinner" /> : 'Confirmar Código Manual'}
                        </button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--gray-400)', margin: '0.5rem 0' }}>
                          <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>O</span>
                          <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
                        </div>

                        <button className="btn btn-ghost" onClick={startScanner} disabled={loading || !estado} style={{ width: '100%' }}>
                          <QrCode size={18} /> Escanear QR en la pantalla
                        </button>

                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
