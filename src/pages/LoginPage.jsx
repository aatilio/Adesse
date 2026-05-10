import { useState } from "react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { api } from "../api/client";
import { toast } from "../components/Toast";
import { mapRolToUiRole } from "../constants/roles";
import appLogo from "../assets/ac-d.svg";

import Footer from "../components/Footer";

export default function LoginPage({ onLogin }) {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    try {
      const { usuario } = await api.login(codigo.trim());
      const role = mapRolToUiRole(usuario.rol);
      if (!role) {
        toast.error("Rol de usuario no reconocido");
        return;
      }

      onLogin({ ...usuario, role });
      toast.success("¡Bienvenido!");
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
        <div className="login-logo" style={{ textAlign: "center", marginBottom: '1.5rem' }}>
          <img 
            src={appLogo} 
            alt="Adese Logo" 
            style={{ width: '70px', height: 'auto', marginBottom: '-0.8rem', display: 'block', margin: '0 auto' }} 
          />
          <div className="login-logo-title" style={{ margin: "0", fontSize: '2rem' }}>
            Adese
          </div>
        </div>

        {/* Form — un solo acceso; el código define si es estudiante o administrador */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Código de acceso</label>
            <div style={{ position: "relative" }}>
              <input
                className="form-input"
                type={showCode ? "text" : "password"}
                autoFocus
                spellCheck={false}
                autoComplete="username"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="CUI"
                style={{ paddingRight: "2.8rem" }}
              />
              <button
                type="button"
                onClick={() => setShowCode(v => !v)}
                aria-label={showCode ? "Ocultar código" : "Mostrar código"}
                style={{
                  position: "absolute",
                  right: "0.8rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--gray-400)",
                  display: "flex",
                  alignItems: "center",
                  padding: "0",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--primary)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--gray-400)"}
              >
                {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !codigo.trim()}
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <>
                  <ChevronRight size={16} /> Ingresar
                </>
              )}
            </button>
          </div>
        </form>

        <Footer />
      </div>
    </div>
  );
}
