import { useCallback } from 'react';
import { Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from './Toast';

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function QrGenerator({ sesion }) {
  const token = sesion.token_qr || '';

  const copyCode = useCallback(async () => {
    if (!token) return;
    const ok = await copyToClipboard(token);
    if (ok) toast.success('Código copiado al portapapeles');
    else toast.error('No se pudo copiar. Selecciona el texto manualmente.');
  }, [token]);

  return (
    <div className="qr-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
      {token ? (
        <QRCodeSVG
          value={token}
          size={260}
          bgColor="#ffffff"
          fgColor="#111827"
          level="H"
          style={{ borderRadius: '8px', border: '10px solid white' }}
        />
      ) : (
        <div style={{ width: 260, height: 260, background: 'var(--gray-100)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ borderTopColor: 'var(--gray-400)' }} />
        </div>
      )}

      <div style={{ marginTop: '1rem', textAlign: 'center', width: '100%', maxWidth: 'min(100%, 520px)' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase' }}>O usa el código manual</p>
        <button
          type="button"
          className="qr-manual-copy"
          onClick={copyCode}
          disabled={!token}
          aria-label="Copiar código al portapapeles"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            background: 'var(--primary-bg)',
            color: 'var(--primary-dark)',
            border: '2px dashed var(--primary-light)',
            padding: '0.8rem 1rem',
            borderRadius: 'var(--radius)',
            cursor: token ? 'pointer' : 'not-allowed',
            opacity: token ? 1 : 0.6,
            font: 'inherit',
            transition: 'filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease',
            overflow: 'hidden',
          }}
        >
          <Copy size={22} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 'clamp(1rem, 2.5vw, 1.8rem)',
              fontWeight: 900,
              letterSpacing: '0.25em',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
              userSelect: 'all',
            }}
          >
            {token}
          </span>
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '0.5rem' }}>
          Pulsa el recuadro para copiar el código completo
        </p>
      </div>
    </div>
  );
}
