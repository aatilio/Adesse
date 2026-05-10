import { useState, useEffect, useRef, useMemo } from "react";
import {
  LogOut,
  QrCode,
  CheckCircle,
  ClipboardList,
  Clock,
  History,
  Camera,
  Radio,
  Library,
  User,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api/client";
import { toast } from "../components/Toast";
import appLogo from "../assets/ac-d.svg";
import UserMenu from "../components/UserMenu";
import Footer from "../components/Footer";

const STEPS = { SELECT: "select", SCANNING: "scanning", DONE: "done" };

export default function StudentPage({ user, onLogout }) {
  const [viewMode, setViewMode] = useState("dashboard"); // dashboard | curso
  const [cursos, setCursos] = useState([]);
  const [cursoActivo, setCursoActivo] = useState(null);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [sesionesCurso, setSesionesCurso] = useState([]);
  const [inputCode, setInputCode] = useState("");

  const [activeTab, setActiveTab] = useState("marcar"); // marcar | historial
  const [step, setStep] = useState(STEPS.SELECT);
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [config, setConfig] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [estadosDB, setEstadosDB] = useState([]);

  // Build dynamic maps from DB
  const ESTADOS = useMemo(
    () => estadosDB.filter((e) => e.nombre !== "Falto").map((e) => e.nombre),
    [estadosDB],
  );
  const ESTADO_COLORS = useMemo(() => {
    const map = {};
    estadosDB.forEach((e) => {
      map[e.nombre] = { bg: e.color, color: "#fff" };
    });
    return map;
  }, [estadosDB]);

  const scannerRef = useRef(null);

  // Time ticker
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Config, Cursos & Estados fetch
  useEffect(() => {
    api
      .getConfiguracion()
      .then((res) => setConfig(res.config))
      .catch(() => {});
    api
      .getEstudianteCursos(user.id)
      .then((res) => setCursos(res.cursos))
      .catch(() => {});
    api
      .getEstados()
      .then((res) => setEstadosDB(res.estados))
      .catch(() => {});
  }, [user.id]);

  // Check for active session
  useEffect(() => {
    const checkSesion = () => {
      api
        .getSesionActiva()
        .then((res) => setSesionActiva(res.sesion))
        .catch(() => setSesionActiva(null));
    };
    checkSesion();
    const interval = setInterval(checkSesion, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  // Fetch Historial & Sesiones
  useEffect(() => {
    if (!cursoActivo) return;
    if (activeTab === "historial") {
      api
        .getHistorialAlumno(user.id)
        .then((res) => setHistorial(res.historial))
        .catch(() => toast.error("Error cargando historial"));
    }
    if (activeTab === "marcar") {
      api
        .getCursoSesiones(cursoActivo.id)
        .then((res) => {
          const today = new Date().toISOString().slice(0, 10);
          const filtradas = (res.sesiones || []).filter((s) => {
            const sDate = s.fecha_programada
              ? s.fecha_programada.slice(0, 10)
              : s.fecha_inicio.slice(0, 10);
            return sDate === today;
          });
          setSesionesCurso(filtradas);
        })
        .catch(() => {});
    }
  }, [activeTab, user.id, cursoActivo]);

  // Determine valid statuses based on rules
  const getValidStatuses = () => {
    let limits = config;
    if (sesionActiva && sesionActiva.limite_puntual) {
      limits = {
        limite_puntual: sesionActiva.limite_puntual,
        limite_presente: sesionActiva.limite_presente,
        limite_tarde: sesionActiva.limite_tarde,
        permitir_falto: sesionActiva.permitir_falto ?? config?.permitir_falto,
      };
    }

    if (!limits) return [];
    const currentHM = currentTime.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    let valid = [];
    if (currentHM <= limits.limite_puntual) {
      valid.push("Puntual");
    } else if (currentHM <= limits.limite_presente) {
      valid.push("Presente");
    } else if (currentHM <= limits.limite_tarde) {
      valid.push("Tarde");
    }

    if (limits.permitir_falto && currentHM > limits.limite_tarde) {
      valid.push("Falto");
    }
    return valid;
  };

  const validStatuses = getValidStatuses();
  useEffect(() => {
    if (validStatuses.length > 0 && !validStatuses.includes(estado)) {
      setEstado(validStatuses[0]);
    } else if (validStatuses.length === 0) {
      setEstado("");
    }
  }, [validStatuses, estado]);

  const startScanner = () => {
    if (!estado) {
      toast.error("Selecciona un estado de asistencia");
      return;
    }
    setStep(STEPS.SCANNING);
    setTimeout(() => initScanner(), 300);
  };

  const initScanner = () => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        handleQrScan,
        () => {},
      )
      .catch(() => {
        toast.error("No se pudo acceder a la cámara");
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
      const reg = {
        estado,
        hora: new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setRegistered(reg);
      setStep(STEPS.DONE);
      toast.success("¡Asistencia registrada!");
    } catch (err) {
      toast.error(err.message);
      setStep(STEPS.SELECT);
    } finally {
      setLoading(false);
    }
  };

  const fmtHora = (iso) =>
    new Date(iso).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtFecha = (iso) => new Date(iso).toLocaleDateString("es-MX");

  return (
    <div className="app-shell">
      <div className="page-header" style={{ justifyContent: "space-between" }}>
        {/* Left Side: Logo & App Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img src={appLogo} alt="Logo" style={{ width: '32px', height: 'auto' }} />
          <div>
            <div style={{ padding: 0 }}>
              <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>Adese</h1>
            </div>
          </div>
        </div>

        {/* Right Side: User Menu Dropdown */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <UserMenu 
            user={user} 
            roleLabel="Estudiante" 
            onLogout={onLogout}
            extraOptions={
              viewMode === "curso" ? [
                {
                  label: "Marcar Asistencia",
                  icon: CheckCircle,
                  onClick: () => setActiveTab("marcar"),
                  active: activeTab === "marcar"
                },
                {
                  label: "Historial",
                  icon: History,
                  onClick: () => setActiveTab("historial"),
                  active: activeTab === "historial"
                }
              ] : []
            }
          />
        </div>
      </div>

      <div className="page-body" style={{ width: "100%", padding: "1rem" }}>
        {viewMode === "dashboard" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <Library size={24} style={{ color: "var(--primary)" }} />
              <h2
                style={{
                  fontSize: "1.2rem",
                  margin: 0,
                  color: "var(--gray-800)",
                }}
              >
                Mis Cursos Matriculados
              </h2>
            </div>
            {cursos.length === 0 ? (
              <div className="empty-state">
                No estás matriculado en ningún curso aún.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "1rem",
                }}
              >
                {cursos.map((c) => (
                  <div
                    key={c.id}
                    className="card"
                    onClick={() => {
                      setCursoActivo(c);
                      setViewMode("curso");
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        color: "var(--primary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <ClipboardList size={18} />{" "}
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        Curso
                      </span>
                    </div>
                    <h3
                      style={{
                        fontSize: "1.1rem",
                        margin: 0,
                        color: "var(--gray-800)",
                      }}
                    >
                      {c.nombre}
                    </h3>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {/* Header & Tabs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "1rem" }}
              >
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setViewMode("dashboard");
                    setRegistered(null);
                    setInputCode("");
                  }}
                  style={{ padding: "6px 10px", background: "white" }}
                >
                  « Volver
                </button>
                <h2
                  style={{
                    fontSize: "1.1rem",
                    margin: 0,
                    color: "var(--gray-800)",
                  }}
                >
                  {cursoActivo?.nombre}
                </h2>
              </div>
              <div className="tabs" style={{ margin: 0 }}>
                <button
                  className={`tab ${activeTab === "marcar" ? "active" : ""}`}
                  onClick={() => setActiveTab("marcar")}
                >
                  <CheckCircle size={16} /> Marcar
                </button>
                <button
                  className={`tab ${activeTab === "historial" ? "active" : ""}`}
                  onClick={() => setActiveTab("historial")}
                >
                  <History size={16} /> Historial
                </button>
              </div>
            </div>

            {activeTab === "historial" ? (
              <div className="attendance-list">
                <h3
                  style={{
                    marginBottom: "1rem",
                    fontSize: "var(--text-md)",
                    color: "var(--gray-700)",
                  }}
                >
                  Historial
                </h3>
                {historial.filter((h) => h.curso_id === cursoActivo.id)
                  .length === 0 ? (
                  <p className="text-muted text-center mt-4">
                    No hay asistencias.
                  </p>
                ) : (
                  historial
                    .filter((h) => h.curso_id === cursoActivo.id)
                    .map((h) => (
                      <div key={h.id} className="attendance-item">
                        <span
                          className={`badge-status`}
                          style={{
                            background: h.color || "#ccc",
                            color: "#fff",
                          }}
                        >
                          {h.estado}
                        </span>
                        <div
                          className="attendance-item-info"
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            width: "100%",
                          }}
                        >
                          <span>{h.nombre_clase}</span>
                          <span className="attendance-item-time">
                            {fmtFecha(h.fecha_hora)} - {fmtHora(h.fecha_hora)}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "1.5rem",
                }}
              >
                {/* Scheduled Sessions */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <h3 style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--gray-500)', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <div style={{ width: '4px', height: '12px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    Clases Programadas
                  </h3>
                  {sesionesCurso.length === 0 ? (
                    <div className="card">No hay clases.</div>
                  ) : (
                    sesionesCurso.map((s) => {
                      const sDate = s.fecha_programada
                        ? new Date(s.fecha_programada)
                        : new Date(s.fecha_inicio);
                      const isToday =
                        sDate.toDateString() === currentTime.toDateString();
                      return (
                         <div
                           key={s.id}
                           className="card"
                           style={{ 
                              padding: '10px 14px',
                              borderLeft: isToday ? '3px solid var(--primary)' : '1px solid var(--gray-200)',
                              background: isToday ? 'var(--primary-bg)' : 'white',
                              borderRadius: '10px',
                              boxShadow: 'none',
                              marginBottom: '2px'
                           }}
                         >
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div>
                               <div style={{ fontWeight: 800, fontSize: "0.8rem", color: 'var(--gray-800)', lineHeight: 1.2 }}>{s.nombre_clase}</div>
                               <div style={{ fontSize: "0.65rem", color: "var(--gray-500)", marginTop: '2px' }}>{fmtFecha(sDate)} • {fmtHora(sDate)}</div>
                             </div>
                             {isToday && (
                               <span style={{ 
                                 background: 'var(--primary)', 
                                 color: 'white', 
                                 padding: '2px 8px', 
                                 borderRadius: '6px', 
                                 fontSize: '0.6rem', 
                                 fontWeight: 900,
                                 textTransform: 'uppercase'
                               }}>
                                 Hoy
                               </span>
                             )}
                           </div>
                         </div>
                       );
                    })
                  )}
                </div>

                {/* Mark Panel */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  <h3 style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--gray-500)', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <div style={{ width: '4px', height: '12px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    Registro
                  </h3>

                  <div className="alert alert-info" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Clock size={16} />
                      <div style={{ fontSize: "0.75rem" }}>
                        Hora:{" "}
                        <strong>{currentTime.toLocaleTimeString("es-MX")}</strong>
                      </div>
                    </div>
                    {estado && (
                      <span className={`badge-status ${estado.toLowerCase()}`} style={{ padding: "0.2rem 0.6rem", fontSize: "0.7rem", minWidth: "auto" }}>
                        {estado}
                      </span>
                    )}
                  </div>

                  {sesionActiva && sesionActiva.curso_id === cursoActivo.id && (
                    <div className="alert alert-success animate-pulse">
                      <Radio size={16} className="live-dot" />
                      <div>
                        <strong>Clase en Vivo:</strong>{" "}
                        {sesionActiva.nombre_clase}
                        <br />
                        <span style={{ fontSize: "var(--text-xs)" }}>
                          Código habilitado
                        </span>
                      </div>
                    </div>
                  )}

                  {registered ? (
                    <div className="card" style={{ textAlign: "center" }}>
                      <CheckCircle
                        size={48}
                        color="var(--success)"
                        style={{ margin: "1rem auto" }}
                      />
                      <div style={{ fontWeight: 700 }}>
                        Asistencia Registrada
                      </div>
                      <div
                        style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}
                      >
                        {registered.hora} - {registered.estado}
                      </div>
                    </div>
                  ) : (
                    <>
                      {validStatuses.length === 0 && !registered && (
                        <div className="alert alert-error">
                          Fuera de horario. No se puede marcar asistencia.
                        </div>
                      )}

                      {validStatuses.length > 0 && (
                        <div className="card">
                          <div className="card-title">Validación</div>
                          {step === STEPS.SCANNING ? (
                            <div>
                              <div
                                id="qr-reader"
                                style={{
                                  borderRadius: "8px",
                                  overflow: "hidden",
                                }}
                              />
                              <button
                                className="btn btn-ghost mt-2 btn-sm"
                                onClick={stopScanner}
                                style={{ width: "100%" }}
                              >
                                Cancelar Escaneo
                              </button>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.75rem",
                              }}
                            >
                              <button
                                className="btn btn-black"
                                onClick={startScanner}
                                disabled={loading || !estado}
                                style={{ width: "100%" }}
                              >
                                <QrCode
                                  size={16}
                                  style={{ marginRight: "6px" }}
                                />{" "}
                                Escanear QR
                              </button>

                              <div
                                style={{
                                  textAlign: "center",
                                  fontSize: "0.7rem",
                                  color: "var(--gray-400)",
                                  margin: "0.25rem 0",
                                }}
                              >
                                O USA EL CÓDIGO
                              </div>

                              <input
                                placeholder="16 DIGITOS"
                                className="form-input"
                                value={inputCode}
                                onChange={(e) =>
                                  setInputCode(e.target.value.toUpperCase())
                                }
                                style={{
                                  textAlign: "center",
                                  letterSpacing: "1px",
                                  fontWeight: "bold",
                                }}
                                maxLength={16}
                              />
                              <button
                                className={`btn btn-sm ${inputCode.length === 16 ? 'btn-success' : 'btn-ghost'}`}
                                onClick={() => handleQrScan(inputCode)}
                                disabled={
                                  loading || !estado || inputCode.length !== 16
                                }
                                style={{
                                  width: "100%",
                                  border: inputCode.length === 16 ? "none" : "1px solid var(--gray-200)",
                                }}
                              >
                                {loading ? (
                                  <div className="spinner" />
                                ) : (
                                  "Confirmar Código"
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              {/* Modal de Asistencia (Mantener fuera para que cubra toda la pantalla si se quisiera) */}
          </div>
        )}
      </div>
      )}
      </div>
      <Footer simple={true} />
    </div>
  );
}
