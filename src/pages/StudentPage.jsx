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
  const [activeTab, setActiveTab] = useState('marcar'); // marcar | historial
  const [step, setStep]           = useState(STEPS.SELECT);
  const [estado, setEstado]       = useState('');
  const [sesion, setSesion]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [registered, setRegistered] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const scannerRef = useRef(null);

  // Time ticker
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Determine valid statuses based on rules
  const getValidStatuses = () => {
    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    const mins = h * 60 + m;

    let valid = [];
    if (mins >= 390 && mins < 420) valid.push('Puntual'); // 6:30 to 6:59
    if (mins >= 420 && mins <= 440) valid.push('Presente'); // 7:00 to 7:20
    if (mins >= 441 && mins <= 500) valid.push('Tarde'); // 7:21 to 8:20
    // Justificado could be manual via teacher only, or available anytime.
    // We'll restrict to automatic states.
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


  // Check for active session
  useEffect(() => {
    const checkSesion = async () => {
      try {
        const { sesion } = await api.getSesionActiva();
        setSesion(sesion);
      } catch { setSesion(null); }
    };
    checkSesion();
    const interval = setInterval(checkSesion, 10000);
    return () => clearInterval(interval);
  }, []);

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

      <div className="tabs">
        <button className={`tab ${activeTab === 'marcar' ? 'active' : ''}`} onClick={() => setActiveTab('marcar')}>
          <Camera size={16} /> Marcar Hoy
        </button>
        <button className={`tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
          <History size={16} /> Mi Historial
        </button>
      </div>

      <div className="page-body">
        {activeTab === 'historial' ? (
          <div>
             <h3 style={{ marginBottom: '1rem', fontSize: 'var(--text-md)', color: 'var(--gray-700)' }}>Historial General</h3>
             {historial.length === 0 ? <p className="text-muted text-center mt-4">No tienes asistencias registradas.</p> : (
               <div className="attendance-list">
                 {historial.map(h => (
                    <div key={h.id} className="attendance-item">
                      <div className="attendance-item-info">
                        <span className="attendance-item-name">{h.nombre_clase}</span>
                        <span className="attendance-item-time">{fmtFecha(h.fecha_hora)} - {fmtHora(h.fecha_hora)}</span>
                      </div>
                      <span className={`badge badge-${h.estado.toLowerCase()}`}>{h.estado}</span>
                    </div>
                 ))}
               </div>
             )}
          </div>
        ) : (
          <>
            {sesion ? (
              <div className="session-chip" style={{ marginBottom: '1.5rem' }}>
                <span className="live-dot" /> Clase: <strong>{sesion.nombre_clase}</strong>
              </div>
            ) : (
              <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
                <span>⚠️</span><span>No hay sesión de clase activa hoy.</span>
              </div>
            )}

            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                <Clock size={18} style={{flexShrink:0}} />
                <div style={{fontSize:'0.75rem'}}>
                  <strong>Reglas de horario:</strong><br/>
                  6:30am a 6:59am: Puntual<br/>
                  7:00am a 7:20am: Presente<br/>
                  7:20am a 8:20am: Tarde<br/>
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
                  <span className={`badge badge-${registered.estado.toLowerCase()}`} style={{ fontSize: 'var(--text-base)', padding: '0.4rem 1rem' }}>
                    {registered.estado}
                  </span>
                </div>
              </div>
            )}

            {!registered && sesion && (
              <>
                <div className="card">
                  <div className="card-title">1. ¿Cómo llegas a clase hoy?</div>
                  <div className="card-subtitle">El sistema bloquea opciones según la hora actual</div>
                  
                  {validStatuses.length === 0 ? (
                    <div className="alert alert-error">
                      <strong>Falta automática:</strong> Has excedido el límite de hora de ingreso (8:20 AM).
                    </div>
                  ) : (
                    <div className="status-grid">
                      {ESTADOS.map(e => {
                        const isAvailable = validStatuses.includes(e) || e === 'Justificado'; // allow Justificado? No, student shouldn't self-justify
                        const isAutoEnabled = validStatuses.includes(e);
                        
                        return (
                          <button
                            key={e} type="button"
                            disabled={!isAutoEnabled}
                            className={`status-option${estado === e ? ' selected' : ''}`}
                            onClick={() => setEstado(e)}
                            style={estado === e 
                              ? { borderColor: ESTADO_COLORS[e]?.color, background: ESTADO_COLORS[e]?.bg, color: ESTADO_COLORS[e]?.color } 
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
                    <div className="card-title">2. Escanea el QR</div>
                    {step === STEPS.SCANNING ? (
                      <div>
                        <div id="qr-reader" ref={scannerRef} style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }} />
                        <button className="btn btn-ghost mt-4" onClick={stopScanner}>Cancelar</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button className="btn btn-primary" onClick={startScanner} disabled={loading || !estado}>
                          {loading ? <div className="spinner" /> : <><QrCode size={18} /> Abrir cámara</>}
                        </button>
                        
                        {/* Botón para desarrollo local */}
                        <button 
                          className="btn btn-ghost" 
                          onClick={() => handleQrScan(sesion.token_qr)} 
                          disabled={loading || !estado || !sesion?.token_qr}
                          style={{ borderColor: 'var(--primary-light)', color: 'var(--primary)' }}
                        >
                          🧪 Simular Escaneo (Modo Local)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
