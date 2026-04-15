import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api/client';

const EXPIRY = 15;

export default function QrGenerator({ sesion }) {
  const [token, setToken]         = useState(sesion.token_qr || '');
  const [secondsLeft, setSeconds] = useState(EXPIRY);
  const intervalRef               = useRef(null);

  const refresh = async () => {
    try {
      const { token: newToken } = await api.refrescarToken(sesion.id);
      setToken(newToken);
      setSeconds(EXPIRY);
    } catch { /* silently retry */ }
  };

  // Countdown tick
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { refresh(); return EXPIRY; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [sesion.id]);

  const pct = (secondsLeft / EXPIRY) * 100;

  return (
    <div className="qr-box">
      {token ? (
        <QRCodeSVG
          value={token}
          size={220}
          bgColor="#ffffff"
          fgColor="#111827"
          level="H"
          style={{ borderRadius: '8px' }}
        />
      ) : (
        <div style={{ width: 220, height: 220, background: 'var(--gray-100)', borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ borderTopColor: 'var(--gray-400)' }} />
        </div>
      )}

      <div className="qr-countdown" style={{ width: '100%', maxWidth: 220 }}>
        <div className="qr-countdown-bar">
          <div className="qr-countdown-fill" style={{ width: `${pct}%`,
            background: secondsLeft <= 5 ? 'var(--danger)' : 'var(--primary)' }} />
        </div>
        <div className="qr-countdown-text">
          Se renueva en <strong>{secondsLeft}s</strong>
        </div>
      </div>

      <button className="btn btn-ghost btn-sm" onClick={refresh} style={{ width: 'auto' }}>
        <RefreshCw size={13} /> Regenerar ahora
      </button>
    </div>
  );
}
