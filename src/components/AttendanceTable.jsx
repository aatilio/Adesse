import { useEffect, useCallback, useRef } from 'react';
import { Users } from 'lucide-react';
import { api } from '../api/client';

const BADGE = {
  Puntual:     'badge-puntual',
  Presente:    'badge-presente',
  Tarde:       'badge-tarde',
  Justificado: 'badge-justificado',
};

const fmt = (iso) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function AttendanceTable({ sesionId, asistencias, setAsistencias }) {
  // Ref para rastrear la cantidad anterior de alumnos y evitar bucles
  const prevCountRef = useRef(asistencias.length);

  // Función para generar un sonido de éxito (Ping)
  const playSuccessSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota La (A5)
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.error("No se pudo reproducir el sonido:", e);
    }
  }, []);

  // Efecto para disparar el sonido cuando aumenta la cuenta
  useEffect(() => {
    if (asistencias.length > prevCountRef.current && prevCountRef.current > 0) {
      playSuccessSound();
    }
    prevCountRef.current = asistencias.length;
  }, [asistencias.length, playSuccessSound]);

  const fetchAsistencias = useCallback(async () => {
    if (!sesionId) return;
    try {
      const { asistencias: rows } = await api.getAsistencias(sesionId);
      setAsistencias(rows);
    } catch { /* silent */ }
  }, [sesionId, setAsistencias]);

  useEffect(() => {
    fetchAsistencias();
    const id = setInterval(fetchAsistencias, 5000);
    return () => clearInterval(id);
  }, [fetchAsistencias]);

  return (
    <div>
      <div className="section-header">
        <span className="section-title">
          <span className="live-dot" /> En vivo
        </span>
        <span className="badge badge-presente">{asistencias.length} registros</span>
      </div>

      {asistencias.length === 0 ? (
        <div className="empty-state">
          <Users size={32} strokeWidth={1.5} />
          <p>Esperando alumnos...</p>
        </div>
      ) : (
        <div className="attendance-list">
          {asistencias.map((a) => (
            <div key={a.id} className="attendance-item">
              <div className="attendance-item-info">
                <span className="attendance-item-name">{a.nombre_completo}</span>
                <span className="attendance-item-code">{a.codigo}</span>
                <span className="attendance-item-time">{fmt(a.fecha_hora)}</span>
              </div>
              <span className={`badge-status ${a.estado.toLowerCase()}`}>{a.estado}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
