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

  // Función para enmascarar el token visualmente
  const maskedToken = token.length > 10 ? `${token.substring(0, 10)}***` : token;

  return (
    <div className="qr-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem' }}>
      {token ? (
        <QRCodeSVG
          value={token}
          size={240}
          bgColor="#ffffff"
          fgColor="#111827"
          level="H"
          style={{ borderRadius: '8px', border: '10px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        />
      ) : (
        <div style={{ width: 240, height: 240, background: 'var(--gray-100)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ borderTopColor: 'var(--gray-400)' }} />
        </div>
      )}

      <div style={{ marginTop: '0.5rem', textAlign: 'center', width: '100%', maxWidth: '320px' }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código Manual</p>
        <button
          type="button"
          className="qr-manual-copy"
          onClick={copyCode}
          disabled={!token}
          title="Click para copiar código completo"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: 'var(--primary-bg)',
            color: 'var(--primary-dark)',
            border: '1px dashed var(--primary-light)',
            padding: '0.6rem 1rem',
            borderRadius: '12px',
            cursor: token ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
          }}
        >
          <Copy size={16} strokeWidth={2.5} style={{ opacity: 0.7 }} />
          <span
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              letterSpacing: '0.15em',
              fontFamily: 'monospace',
              color: 'var(--primary-dark)',
            }}
          >
            {maskedToken}
          </span>
        </button>
        <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginTop: '0.5rem' }}>
          Haz clic para copiar el código completo de 16 dígitos
        </p>
      </div>
    </div>
  );
}
