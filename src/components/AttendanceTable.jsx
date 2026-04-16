import { useEffect, useCallback } from 'react';
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
  const fetch = useCallback(async () => {
    if (!sesionId) return;
    try {
      const { asistencias: rows } = await api.getAsistencias(sesionId);
      setAsistencias(rows);
    } catch { /* silent */ }
  }, [sesionId]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 5000); // polling cada 5s
    return () => clearInterval(id);
  }, [fetch]);

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
