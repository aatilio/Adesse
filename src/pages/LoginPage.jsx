import { useState } from "react";
import {
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { api } from "../api/client";
import { toast } from "../components/Toast";
import { mapRolToUiRole } from "../constants/roles";

export default function LoginPage({ onLogin }) {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);

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
        <div className="login-logo">
          <div className="login-logo-icon">
            <ClipboardList size={30} />
          </div>
          <div>
            <div className="login-logo-title">ADESSE</div>
            <div className="login-logo-sub">
              Asistencia Digital Estratégica para el Sector Educativo
            </div>
          </div>
        </div>

        {/* Form — un solo acceso; el código define si es estudiante o administrador */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Código de acceso</label>
            <input
              className="form-input"
              type="text"
              autoFocus
              spellCheck={false}
              autoComplete="username"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="CUI o código de administrador"
            />
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

        <p
          style={{
            fontSize: "10px",
            color: "var(--gray-400)",
            textAlign: "center",
            marginTop: "1rem",
          }}
        >
          Copyright &copy; {new Date().getFullYear()}{" "}
          <a href="./" style={{ color: "inherit", textDecoration: "none" }}>
            <b>Adesse</b>
          </a>
          . Todos los derechos reservados. Desarrollado por{" "}
          <b>
            <a
              href="https://alan.arahocorp.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit" }}
            >
              Arahocorp
            </a>
          </b>
        </p>
      </div>
    </div>
  );
}
