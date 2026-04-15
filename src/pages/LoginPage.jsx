import { useState } from 'react';
import { ClipboardList, User, GraduationCap, ChevronRight, Loader } from 'lucide-react';
import { api } from '../api/client';
import { toast } from '../components/Toast';

export default function LoginPage({ onLogin }) {
  const [codigo, setCodigo]   = useState('');
  const [role, setRole]       = useState('alumno'); // 'alumno' | 'profesor'
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    try {
      if (role === 'profesor') {
        // El profesor accede directamente con código PROF01
        const { estudiante } = await api.login(codigo.trim());
        if (!codigo.toUpperCase().startsWith('PROF')) {
          toast.error('Código de profesor inválido');
          setLoading(false);
          return;
        }
        localStorage.setItem('sai_user', JSON.stringify({ ...estudiante, role: 'profesor' }));
        onLogin({ ...estudiante, role: 'profesor' });
      } else {
        const { estudiante } = await api.login(codigo.trim());
        localStorage.setItem('sai_user', JSON.stringify({ ...estudiante, role: 'alumno' }));
        onLogin({ ...estudiante, role: 'alumno' });
      }
      toast.success('¡Bienvenido!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <ClipboardList size={30} />
          </div>
          <div>
            <div className="login-logo-title">SAI</div>
            <div className="login-logo-sub">Sistema de Asistencia Inteligente</div>
          </div>
        </div>

        {/* Role Switcher */}
        <div className="role-switcher">
          <button
            type="button"
            className={role === 'alumno' ? 'active' : ''}
            onClick={() => setRole('alumno')}
          >
            <GraduationCap size={14} style={{ display:'inline', marginRight:6 }} />
            Alumno
          </button>
          <button
            type="button"
            className={role === 'profesor' ? 'active' : ''}
            onClick={() => setRole('profesor')}
          >
            <User size={14} style={{ display:'inline', marginRight:6 }} />
            Profesor
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              {role === 'alumno' ? 'Código de Estudiante' : 'Código de Profesor'}
            </label>
            <input
              className="form-input"
              type="text"
              autoFocus
              spellCheck={false}
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder={role === 'alumno' ? 'Ej: ALU001' : 'Ej: PROF01'}
            />
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-primary" type="submit" disabled={loading || !codigo.trim()}>
              {loading ? <div className="spinner" /> : <><ChevronRight size={16} /> Ingresar</>}
            </button>
          </div>
        </form>

        <div className="divider" />
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', textAlign: 'center' }}>
          Alumnos de prueba: ALU001 – ALU005 &nbsp;|&nbsp; Profesor: PROF01
        </p>
      </div>
    </div>
  );
}
