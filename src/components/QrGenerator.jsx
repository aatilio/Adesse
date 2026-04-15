import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api/client';

const EXPIRY = 15;

export default function QrGenerator({ sesion }) {
  const token = sesion.token_qr || '';

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

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase' }}>O usa el código manual</p>
        <div style={{
          background: 'var(--primary-bg)',
          color: 'var(--primary-dark)',
          border: '2px dashed var(--primary-light)',
          padding: '0.8rem 2rem',
          borderRadius: 'var(--radius)',
          fontSize: '2rem',
          fontWeight: 900,
          letterSpacing: '8px',
          fontFamily: 'monospace'
        }}>
          {token}
        </div>
      </div>
    </div>
  );
}
