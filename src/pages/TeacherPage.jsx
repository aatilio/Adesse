import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  StopCircle,
  LogOut,
  ClipboardList,
  Users,
  History,
  Radio,
  Settings,
  BookOpen,
  Calendar,
  Trash2,
  Play,
  UserPlus,
  X,
  Edit,
} from "lucide-react";
import { api } from "../api/client";
import { ROL } from "../constants/roles";
import { toast } from "../components/Toast";
import QrGenerator from "../components/QrGenerator";
import AttendanceTable from "../components/AttendanceTable";

export default function TeacherPage({ user, onLogout }) {
  // ── Course-level state ──────────────────────────────────
  const [cursos, setCursos] = useState([]);
  const [cursoActivo, setCursoActivo] = useState(null);
  const [showNewCurso, setShowNewCurso] = useState(false);
  const [newCursoName, setNewCursoName] = useState("");

  // ── Tab state ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("vivo"); // vivo | alumnos | clases | historial | config
  const [viewMode, setViewMode] = useState("dashboard"); // dashboard | curso

  // ── Live session ────────────────────────────────────────
  const [sesion, setSesion] = useState(null);
  const [nombreClase, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [asistencias, setAsistencias] = useState([]);
  const [checking, setChecking] = useState(true);

  // ── Data per tab ────────────────────────────────────────
  const [estudiantesCurso, setEstudiantesCurso] = useState([]);
  const [todosEstudiantes, setTodosEstudiantes] = useState([]);
  const [sesionesProgr, setSesionesProgr] = useState([]);
  const [historialGen, setHistorialGen] = useState([]);
  const [config, setConfig] = useState(null);

  // ── New class scheduling ────────────────────────────────
  const [newClaseName, setNewClaseName] = useState("");
  const [newClaseDate, setNewClaseDate] = useState("");
  const [showLimits, setShowLimits] = useState(false);
  const [limPuntual, setLimPuntual] = useState("");
  const [limPresente, setLimPresente] = useState("");
  const [limTarde, setLimTarde] = useState("");

  const [editingSesion, setEditingSesion] = useState(null);
  const [editSesionData, setEditSesionData] = useState({
    nombre_clase: "",
    fecha_programada: "",
    limite_puntual: "",
    limite_presente: "",
    limite_tarde: ""
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (config) {
      setLimPuntual(config.limite_puntual);
      setLimPresente(config.limite_presente);
      setLimTarde(config.limite_tarde);
    }
  }, [config]);

  // ── Init: load courses ──────────────────────────────────
  useEffect(() => {
    api
      .getCursos()
      .then((res) => {
        setCursos(res.cursos);
        if (res.cursos.length > 0) setCursoActivo(res.cursos[0]);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // ── Load active session ─────────────────────────────────
  useEffect(() => {
    api
      .getSesionActiva()
      .then((res) => setSesion(res.sesion))
      .catch(() => {});
  }, []);

  // ── Fetch tab data when tab or course changes ───────────
  useEffect(() => {
    if (!cursoActivo) return;
    const id = cursoActivo.id;

    if (activeTab === "alumnos") {
      Promise.all([api.getCursoEstudiantes(id), api.getEstudiantes()]).then(
        ([resC, resA]) => {
          setEstudiantesCurso(resC.estudiantes);
          setTodosEstudiantes(
            resA.estudiantes.filter((e) => Number(e.rol) === ROL.ESTUDIANTE),
          );
        },
      );
    } else if (activeTab === "clases") {
      api.getCursoSesiones(id).then((res) => setSesionesProgr(res.sesiones));
    } else if (activeTab === "historial") {
      Promise.all([
        api.getCursoHistorial(id),
        api.getCursoEstudiantes(id),
      ]).then(([resH, resE]) => {
        setHistorialGen(resH.historial);
        setEstudiantesCurso(resE.estudiantes);
      });
    } else if (activeTab === "config") {
      api.getConfiguracion().then((res) => setConfig(res.config));
    }
  }, [activeTab, cursoActivo]);

  // ── Actions ─────────────────────────────────────────────
  const crearCurso = async (e) => {
    e.preventDefault();
    if (!newCursoName.trim()) return;
    try {
      const { curso } = await api.crearCurso({ nombre: newCursoName.trim() });
      setCursos((prev) => [curso, ...prev]);
      setCursoActivo(curso);
      setNewCursoName("");
      setShowNewCurso(false);
      setViewMode("curso");
      toast.success(`Curso "${curso.nombre}" creado`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const eliminarCurso = async (id) => {
    if (!confirm("¿Eliminar este curso y todas sus clases programadas?"))
      return;
    try {
      await api.deleteCurso(id);
      const updated = cursos.filter((c) => c.id !== id);
      setCursos(updated);
      setCursoActivo(updated[0] || null);
      toast.info("Curso eliminado");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addAlumno = async (estudianteId) => {
    try {
      await api.addEstudianteCurso(cursoActivo.id, estudianteId);
      const res = await api.getCursoEstudiantes(cursoActivo.id);
      setEstudiantesCurso(res.estudiantes);
      toast.success("Alumno añadido al curso");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeAlumno = async (estudianteId) => {
    try {
      await api.removeEstudianteCurso(cursoActivo.id, estudianteId);
      setEstudiantesCurso((prev) => prev.filter((e) => e.id !== estudianteId));
      toast.info("Alumno removido del curso");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const programarClase = async (e) => {
    e.preventDefault();
    if (!newClaseName.trim() || !newClaseDate) return;
    try {
      await api.crearCursoSesion(cursoActivo.id, {
        nombre_clase: newClaseName.trim(),
        fecha_programada: newClaseDate,
        limite_puntual:  showLimits ? limPuntual  : undefined,
        limite_presente: showLimits ? limPresente : undefined,
        limite_tarde:    showLimits ? limTarde    : undefined
      });
      const res = await api.getCursoSesiones(cursoActivo.id);
      setSesionesProgr(res.sesiones);
      setNewClaseName("");
      setNewClaseDate("");
      setShowLimits(false);
      toast.success("Clase programada");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEditForm = (sesion) => {
    setEditingSesion(sesion.id);
    let formattedDate = "";
    if (sesion.fecha_programada) {
      const d = new Date(sesion.fecha_programada);
      const yyyy = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      formattedDate = `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
    } else if (sesion.fecha_inicio) {
      const d = new Date(sesion.fecha_inicio);
      const yyyy = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      formattedDate = `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
    }
    
    setEditSesionData({
      nombre_clase: sesion.nombre_clase || "",
      fecha_programada: formattedDate,
      limite_puntual: sesion.limite_puntual || config?.limite_puntual || "",
      limite_presente: sesion.limite_presente || config?.limite_presente || "",
      limite_tarde: sesion.limite_tarde || config?.limite_tarde || ""
    });
  };

  const saveEditedSesion = async (e) => {
    e.preventDefault();
    if (!editSesionData.nombre_clase.trim() || !editSesionData.fecha_programada) return;
    try {
      await api.updateSesion(editingSesion, {
        nombre_clase: editSesionData.nombre_clase.trim(),
        fecha_programada: editSesionData.fecha_programada,
        limite_puntual: editSesionData.limite_puntual,
        limite_presente: editSesionData.limite_presente,
        limite_tarde: editSesionData.limite_tarde
      });
      const res = await api.getCursoSesiones(cursoActivo.id);
      setSesionesProgr(res.sesiones);
      setEditingSesion(null);
      toast.success("Clase actualizada con éxito");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const activarSesion = async (sesionId) => {
    try {
      const { sesion: s } = await api.activarSesion(sesionId);
      setSesion(s);
      setActiveTab("vivo");
      toast.success("¡Sesión iniciada! QR activo.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cerrarSesion = async () => {
    if (!sesion) return;
    if (!confirm("¿Cerrar la sesión actual?")) return;
    try {
      await api.cerrarSesion(sesion.id);
      setSesion(null);
      setAsistencias([]);
      toast.info("Sesión cerrada");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const eliminarSesionProgramada = (id) => {
    setConfirmDeleteId(id); // abre el modal de confirmación
  };

  const confirmarEliminar = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.cerrarSesion(id);
      setSesionesProgr((prev) => prev.filter((s) => s.id !== id));
      toast.info("Clase eliminada");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const crearSesionLive = async (e) => {
    e.preventDefault();
    if (!nombreClase.trim()) return;
    setLoading(true);
    try {
      const { sesion: s } = await api.crearSesion(
        nombreClase.trim(),
        cursoActivo.id,
      );
      setSesion(s);
      setAsistencias([]);
      toast.success(`Sesión "${s.nombre_clase}" iniciada`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateAsistenciaEstado = async (id, estado) => {
    const ast = historialGen.find((a) => a.id === id);
    if (!ast || ast.estado === estado) return;
    try {
      await api.updateAsistencia(id, { estado });
      setHistorialGen((prev) =>
        prev.map((a) => (a.id === id ? { ...a, estado } : a)),
      );
      toast.success("Estado actualizado");
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const createAsistenciaManual = async (estudiante_id, sesion_id, estado) => {
    try {
      await api.crearAsistenciaManual({ estudiante_id, sesion_id, estado });
      const res = await api.getCursoHistorial(cursoActivo.id);
      setHistorialGen(res.historial);
      toast.success("Asistencia registrada");
    } catch {
      toast.error("Error al registrar asistencia");
    }
  };

  const updateConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateConfiguracion(config);
      toast.success("Ajustes de horario actualizados");
    } catch {
      toast.error("Error actualizando configuraciones");
    } finally {
      setLoading(false);
    }
  };

  const updateEstudiante = async (id, field, value) => {
    const est = estudiantesCurso.find((e) => e.id === id);
    if (!est || est[field] === value) return;
    const payload = { ...est, [field]: value };
    try {
      await api.updateEstudiante(id, payload);
      setEstudiantesCurso((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
      );
      toast.success("Alumno actualizado");
    } catch {
      toast.error("Error al actualizar alumno");
    }
  };

  // ── Derived data for matrix ─────────────────────────────
  const clasesColumns = useMemo(() => {
    const clsMap = new Map();
    historialGen.forEach((a) => {
      const dt = new Date(a.fecha_hora);
      clsMap.set(a.sesion_id, {
        id: a.sesion_id,
        name: a.nombre_clase,
        dt: dt.getTime(),
        label: dt.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
        }),
      });
    });
    return Array.from(clsMap.values()).sort((a, b) => a.dt - b.dt);
  }, [historialGen]);

  const alumnosNoInscritos = useMemo(() => {
    const ids = new Set(estudiantesCurso.map((e) => e.id));
    return todosEstudiantes.filter((e) => !ids.has(e.id));
  }, [todosEstudiantes, estudiantesCurso]);

  // ── Helpers ─────────────────────────────────────────────
  const fmtFecha = (iso) => {
    if (!iso) return "—";
    const date = new Date(iso);
    return `${date.toLocaleDateString("es-MX")} ${date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
  };

  if (checking) {
    return (
      <div
        className="app-shell"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <div
          className="spinner"
          style={{ borderTopColor: "var(--primary)", width: 32, height: 32 }}
        />
      </div>
    );
  }

  const ESTADOS_UI = {
    Puntual: { bg: "#4ade80", color: "#064e3b" },
    Presente: { bg: "#60a5fa", color: "#1e3a8a" },
    Tarde: { bg: "#fb923c", color: "#7c2d12" },
    Justificado: { bg: "#c084fc", color: "#4c1d95" },
    Falto: { bg: "#f87171", color: "#7f1d1d" },
  };

  return (
    <div className="app-shell">
      {/* ── Modal Confirmar Eliminar Sesión ──────────── */}
      {confirmDeleteId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(15,23,42,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}>
          <div style={{
            background: "white", borderRadius: "16px",
            padding: "2rem", maxWidth: "420px", width: "100%",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
            animation: "slideIn 0.2s ease",
          }}>
            <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "0.75rem" }}>🗑️</div>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--gray-900)", textAlign: "center", fontSize: "1.1rem", fontWeight: 700 }}>
              ¿Eliminar esta clase?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", textAlign: "center", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
              Esta acción es <strong style={{ color: "var(--danger)" }}>irreversible</strong>.<br/>
              Se eliminarán también todos los registros de asistencia asociados a esta clase.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDeleteId(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmarEliminar}
                style={{ flex: 1 }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="page-header" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ClipboardList size={20} />
          <div>
            <div style={{ padding: 0, display: "flex", alignItems: "center" }}>
              <h1>Panel Docente</h1>
            </div>
            <div className="subtitle">{user.nombre_completo}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="btn btn-sm btn-ghost"
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "white",
            border: "none",
          }}
        >
          <LogOut size={14} /> Salir
        </button>
      </div>

      {/* DASHBOARD: Grid of Courses */}
      {viewMode === "dashboard" ? (
        <div style={{ padding: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.2rem",
                margin: 0,
                color: "var(--gray-800)",
              }}
            >
              Mis Cursos
            </h2>
            {!showNewCurso ? (
              <button
                className="btn btn-primary"
                onClick={() => setShowNewCurso(true)}
              >
                <Plus size={16} /> Crear Curso
              </button>
            ) : (
              <form
                onSubmit={crearCurso}
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <input
                  type="text"
                  placeholder="Nombre del curso"
                  autoFocus
                  value={newCursoName}
                  onChange={(e) => setNewCursoName(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--gray-300)",
                  }}
                />
                <button className="btn btn-primary btn-sm" type="submit">
                  Guardar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setShowNewCurso(false)}
                >
                  <X size={16} />
                </button>
              </form>
            )}
          </div>

          {cursos.length === 0 && !checking ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                color: "var(--gray-500)",
                background: "white",
                borderRadius: "8px",
                border: "1px dashed var(--gray-300)",
              }}
            >
              <BookOpen
                size={48}
                style={{ margin: "0 auto 1rem", opacity: 0.3 }}
              />
              <p>
                No tienes cursos. Crea tu primer curso para comenzar a gestionar
                asistencias.
              </p>
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
                  style={{
                    cursor: "pointer",
                    transition: "transform 0.2s",
                    margin: 0,
                  }}
                  onClick={() => {
                    setCursoActivo(c);
                    setViewMode("curso");
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "translateY(-2px)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "none")
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          color: "var(--primary)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <BookOpen size={18} />
                        <span
                          style={{ fontWeight: "500", fontSize: "0.85rem" }}
                        >
                          Curso
                        </span>
                      </div>
                      <h3
                        style={{
                          fontSize: "1.1rem",
                          margin: "0 0 0.5rem 0",
                          color: "var(--gray-800)",
                        }}
                      >
                        {c.nombre}
                      </h3>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarCurso(c.id);
                      }}
                      style={{ color: "var(--danger)", padding: "4px" }}
                      title="Eliminar curso"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      marginTop: "1rem",
                      fontSize: "0.85rem",
                      color: "var(--gray-500)",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Users size={14} /> {c.total_alumnos} Alumnos
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Calendar size={14} /> {c.total_clases} Clases
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* COURSE VIEW: Header & Tabs */}
          <div className="teacher-course-toolbar">
            <button
              type="button"
              className="btn btn-sm btn-ghost teacher-back-btn"
              onClick={() => setViewMode("dashboard")}
            >
              « Volver a Cursos
            </button>
            <h2 className="teacher-course-title">
              <BookOpen size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
              <span className="teacher-course-title-text">{cursoActivo?.nombre}</span>
            </h2>
          </div>

          <div className="tabs" style={{ flexWrap: "wrap" }}>
            <button
              className={`tab ${activeTab === "vivo" ? "active" : ""}`}
              onClick={() => setActiveTab("vivo")}
            >
              <Radio size={16} /> Monitor
            </button>
            <button
              className={`tab ${activeTab === "alumnos" ? "active" : ""}`}
              onClick={() => setActiveTab("alumnos")}
            >
              <Users size={16} /> Alumnos
            </button>
            <button
              className={`tab ${activeTab === "clases" ? "active" : ""}`}
              onClick={() => setActiveTab("clases")}
            >
              <Calendar size={16} /> Clases
            </button>
            <button
              className={`tab ${activeTab === "historial" ? "active" : ""}`}
              onClick={() => setActiveTab("historial")}
            >
              <History size={16} /> Historial
            </button>
            <button
              className={`tab ${activeTab === "config" ? "active" : ""}`}
              onClick={() => setActiveTab("config")}
            >
              <Settings size={16} /> Ajustes
            </button>
          </div>

          <div className="page-body" style={{ width: "100%" }}>
            {/* ─── MONITOR EN VIVO ─────────────────────── */}
            {activeTab === "vivo" &&
              (!sesion || sesion.curso_id !== cursoActivo?.id ? (
                <div
                  className="card"
                  style={{ maxWidth: 480, margin: "0 auto" }}
                >
                  <div className="card-title">
                    <Plus size={18} /> Nueva Sesión Rápida
                  </div>
                  <div className="card-subtitle">
                    Inicia una sesión de clase en vivo con código QR para{" "}
                    {cursoActivo.nombre}.
                  </div>
                  <form onSubmit={crearSesionLive}>
                    <div className="form-group">
                      <label className="form-label">Nombre de la clase</label>
                      <input
                        className="form-input"
                        type="text"
                        autoFocus
                        value={nombreClase}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej: Sesión 5 - Regresión"
                      />
                    </div>
                    <div style={{ marginTop: "1.5rem" }}>
                      <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={loading || !nombreClase.trim()}
                      >
                        {loading ? (
                          <div className="spinner" />
                        ) : (
                          <>
                            <Plus size={16} /> Iniciar Sesión Live
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="teacher-live-grid">
                  <div className="teacher-live-col-qr">
                    <div className="session-chip session-chip--live">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span className="live-dot" />{" "}
                        <strong>{sesion.nombre_clase}</strong>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm session-chip-end"
                        onClick={cerrarSesion}
                      >
                        <StopCircle size={13} /> Terminar
                      </button>
                    </div>
                    <div
                      className="card teacher-qr-card"
                    >
                      <QrGenerator sesion={sesion} />
                    </div>
                  </div>
                  <div className="card teacher-attendance-card">
                    <AttendanceTable
                      sesionId={sesion.id}
                      asistencias={asistencias}
                      setAsistencias={setAsistencias}
                    />
                  </div>
                </div>
              ))}

            {/* ─── ALUMNOS DEL CURSO ──────────────────── */}
            {activeTab === "alumnos" && (
              <div className="card">
                <div className="card-title">
                  Alumnos de {cursoActivo.nombre}
                </div>
                <div className="card-subtitle">
                  {estudiantesCurso.length} inscritos. Añade o remueve alumnos
                  de este curso.
                </div>

                {/* Add student dropdown */}
                {alumnosNoInscritos.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                      margin: "1rem 0",
                      padding: "0.75rem",
                      background: "#f0fdf4",
                      borderRadius: "8px",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    <UserPlus
                      size={16}
                      style={{ color: "#16a34a", flexShrink: 0 }}
                    />
                    <select
                      id="add-student-select"
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--gray-300)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {alumnosNoInscritos.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre_completo} ({e.codigo})
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const sel =
                          document.getElementById("add-student-select");
                        if (sel) addAlumno(Number(sel.value));
                      }}
                    >
                      Añadir
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {estudiantesCurso.map((est) => (
                    <div key={est.id} className="editable-row">
                      <input
                        type="text"
                        defaultValue={est.nombre_completo}
                        onBlur={(e) =>
                          updateEstudiante(
                            est.id,
                            "nombre_completo",
                            e.target.value,
                          )
                        }
                        placeholder="Nombre"
                      />
                      <input
                        type="text"
                        defaultValue={est.codigo}
                        onBlur={(e) =>
                          updateEstudiante(
                            est.id,
                            "codigo",
                            e.target.value,
                          )
                        }
                        placeholder="CUI"
                      />
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => removeAlumno(est.id)}
                        style={{ color: "#ef4444" }}
                        title="Quitar del curso"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── CLASES PROGRAMADAS ─────────────────── */}
            {activeTab === "clases" && (
              <div className="card">
                <div className="card-title">
                  <Calendar size={18} /> Clases de {cursoActivo.nombre}
                </div>
                <div className="card-subtitle">
                  Programa las fechas de tus clases. Puedes iniciar la sesión QR
                  desde aquí.
                </div>

                {/* Schedule form */}
                <form
                  onSubmit={programarClase}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    margin: "1rem 0",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div className="form-group" style={{ flex: 1, minWidth: "150px" }}>
                      <label className="form-label">Nombre</label>
                      <input
                        className="form-input"
                        type="text"
                        value={newClaseName}
                        onChange={(e) => setNewClaseName(e.target.value)}
                        placeholder="Ej: Clase 6 - Hipótesis"
                      />
                    </div>
                    <div className="form-group" style={{ minWidth: "180px" }}>
                      <label className="form-label">Fecha y Hora</label>
                      <input
                        className="form-input"
                        type="datetime-local"
                        value={newClaseDate}
                        onChange={(e) => setNewClaseDate(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={!newClaseName.trim() || !newClaseDate}
                      style={{ marginBottom: "0.25rem" }}
                    >
                      <Plus size={14} /> Programar
                    </button>
                  </div>
                  
                  <div style={{ padding: "0.5rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: "bold", color: "var(--gray-700)", cursor: "pointer" }}>
                      <input type="checkbox" checked={showLimits} onChange={e => setShowLimits(e.target.checked)} />
                      Configurar horario límite personalizado para esta clase
                    </label>
                    
                    {showLimits && (
                      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: "0.75rem", color: ESTADOS_UI.Puntual.bg }}>Límite Puntual</label>
                          <input type="time" className="form-input" value={limPuntual} onChange={e => setLimPuntual(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: "0.75rem", color: ESTADOS_UI.Presente.bg }}>Límite Presente</label>
                          <input type="time" className="form-input" value={limPresente} onChange={e => setLimPresente(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: "0.75rem", color: ESTADOS_UI.Tarde.bg }}>Límite Tarde</label>
                          <input type="time" className="form-input" value={limTarde} onChange={e => setLimTarde(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                </form>

                {/* Session list */}
                {sesionesProgr.length === 0 ? (
                  <p className="text-muted">No hay clases programadas aún.</p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {sesionesProgr.map((s) => (
                      <div key={s.id}>
                        {editingSesion === s.id ? (
                          <form onSubmit={saveEditedSesion} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "0.5rem" }}>
                            {/* Fila 1: Nombre + Fecha */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: "0.75rem" }}>Nombre</label>
                                <input type="text" className="form-input" value={editSesionData.nombre_clase} onChange={e => setEditSesionData({...editSesionData, nombre_clase: e.target.value})} required />
                              </div>
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: "0.75rem" }}>Fecha</label>
                                <input type="datetime-local" className="form-input" value={editSesionData.fecha_programada} onChange={e => setEditSesionData({...editSesionData, fecha_programada: e.target.value})} required />
                              </div>
                            </div>
                            {/* Fila 2: Tres límites */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: "0.75rem", color: "#059669" }}>Límite Puntual</label>
                                <input type="time" className="form-input" value={editSesionData.limite_puntual} onChange={e => setEditSesionData({...editSesionData, limite_puntual: e.target.value})} />
                              </div>
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: "0.75rem", color: "#2563eb" }}>Límite Presente</label>
                                <input type="time" className="form-input" value={editSesionData.limite_presente} onChange={e => setEditSesionData({...editSesionData, limite_presente: e.target.value})} />
                              </div>
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: "0.75rem", color: "#d97706" }}>Límite Tarde</label>
                                <input type="time" className="form-input" value={editSesionData.limite_tarde} onChange={e => setEditSesionData({...editSesionData, limite_tarde: e.target.value})} />
                              </div>
                            </div>
                            {/* Acciones */}
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingSesion(null)}>Cancelar</button>
                              <button type="submit" className="btn btn-sm btn-primary">Guardar Cambios</button>
                            </div>
                          </form>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "1rem",
                              padding: "0.75rem 1rem",
                              background: s.activa ? "#ecfdf5" : "#f9fafb",
                              borderRadius: "8px",
                              border: `1px solid ${s.activa ? "#86efac" : "#e5e7eb"}`,
                              marginBottom: "0.5rem"
                            }}
                          >
                            <div
                              style={{ display: "flex", flexDirection: "column" }}
                            >
                              <strong style={{ fontSize: "0.9rem" }}>
                                {s.nombre_clase}
                              </strong>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--gray-500)",
                                }}
                              >
                                {s.fecha_programada
                                  ? fmtFecha(s.fecha_programada)
                                  : fmtFecha(s.fecha_inicio)}
                                {s.total_asistencias > 0 &&
                                  ` • ${s.total_asistencias} registros`}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                alignItems: "center",
                              }}
                            >
                              {s.activa ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: "#dcfce7",
                                    color: "#16a34a",
                                  }}
                                >
                                  EN VIVO
                                </span>
                              ) : (
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => activarSesion(s.id)}
                                >
                                  <Play size={12} /> Iniciar
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => openEditForm(s)}
                                style={{ color: "var(--gray-600)", padding: "4px" }}
                                title="Editar clase"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => eliminarSesionProgramada(s.id)}
                                style={{ color: "#ef4444", padding: "4px" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── HISTORIAL / MATRIZ ─────────────────── */}
            {activeTab === "historial" && (
              <div
                className="card"
                style={{ maxWidth: "100%", overflow: "hidden" }}
              >
                <div className="card-title">
                  Matriz de Asistencias — {cursoActivo.nombre}
                </div>
                <div className="card-subtitle">
                  Vista acumulada estilo hoja de cálculo. Clic en la celda para
                  cambiar estado.
                </div>

                {historialGen.length === 0 ? (
                  <p className="text-muted" style={{ marginTop: "1rem" }}>
                    No hay clases o registros aún para este curso.
                  </p>
                ) : (
                  <div className="table-responsive" style={{ marginTop: "1rem" }}>
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th className="sticky-column" style={{ textAlign: "left" }}>
                            Estudiante
                          </th>
                          {clasesColumns.map((c) => (
                            <th
                              key={c.id}
                              style={{
                                padding: "8px 4px",
                                borderBottom: "2px solid var(--gray-200)",
                                minWidth: "50px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.72rem",
                                  color: "var(--primary)",
                                  lineHeight: 1.2,
                                }}
                              >
                                {c.label}
                              </div>
                            </th>
                          ))}
                          <th
                            style={{
                              padding: "10px 8px",
                              borderBottom: "2px solid var(--gray-200)",
                              background: "var(--primary-bg)",
                              color: "var(--primary-dark)",
                              position: "sticky",
                              right: 0,
                              zIndex: 2,
                              minWidth: "50px",
                            }}
                          >
                            Punt.
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {estudiantesCurso.map((est, i) => {
                          const recs = historialGen.filter(
                            (h) => h.estudiante_id === est.id,
                          );
                          const points = recs.reduce((acc, h) => {
                            if (h.estado === "Puntual") return acc + 2;
                            if (h.estado === "Presente") return acc + 1;
                            if (h.estado === "Justificado") return acc + 2;
                            if (h.estado === "Tarde") return acc + 1;
                            return acc;
                          }, 0);

                          return (
                            <tr
                              key={est.id}
                              style={{
                                background: i % 2 === 0 ? "#fff" : "#fafafa",
                              }}
                            >
                              <td className="sticky-column">
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: "600",
                                      color: "var(--gray-800)",
                                      fontSize: "0.78rem",
                                    }}
                                  >
                                    {est.nombre_completo}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.68rem",
                                      color: "var(--gray-400)",
                                    }}
                                  >
                                    {est.codigo}
                                  </span>
                                </div>
                              </td>
                              {clasesColumns.map((c) => {
                                const r = recs.find(
                                  (h) => h.sesion_id === c.id,
                                );
                                const status = r ? r.estado : "";
                                const ui = status ? ESTADOS_UI[status] : null;
                                const bgColor = ui ? ui.bg : "transparent";
                                const textColor = ui ? ui.color : "var(--gray-300)";

                                return (
                                  <td
                                    key={c.id}
                                    style={{
                                      padding: "6px",
                                      borderLeft: "1px solid var(--gray-100)",
                                      background: "transparent",
                                      verticalAlign: "middle"
                                    }}
                                  >
                                    <div style={{
                                        background: bgColor,
                                        borderRadius: "16px",
                                        padding: status ? "2px 6px" : "2px",
                                        display: "flex",
                                        justifyContent: "center",
                                        minWidth: "85px",
                                        margin: "0 auto"
                                    }}>
                                      <select
                                        value={status}
                                        onChange={(e) => {
                                          if (!e.target.value) return;
                                          if (r)
                                            updateAsistenciaEstado(
                                              r.id,
                                              e.target.value,
                                            );
                                          else
                                            createAsistenciaManual(
                                              est.id,
                                              c.id,
                                                  e.target.value,
                                            );
                                        }}
                                        className={`badge-status ${status.toLowerCase()}`}
                                        style={{
                                          width: "100%",
                                          height: "28px",
                                          appearance: "none",
                                          border: "none",
                                          background: "transparent",
                                          textAlign: "center",
                                          cursor: "pointer",
                                          outline: "none",
                                          fontWeight: "700",
                                          fontSize: "0.75rem",
                                          color: "inherit",
                                        }}
                                      >
                                        <option
                                          value=""
                                          disabled
                                          style={{ color: "#000" }}
                                        >
                                          —
                                        </option>
                                        {Object.keys(ESTADOS_UI).map((k) => (
                                          <option
                                            key={k}
                                            value={k}
                                            style={{
                                              color: "#000",
                                              fontWeight: "bold",
                                              background: "white"
                                            }}
                                          >
                                            {k}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </td>
                                );
                              })}
                              <td
                                style={{
                                  fontWeight: "bold",
                                  borderLeft: "2px solid var(--gray-200)",
                                  background: "var(--primary-bg)",
                                  color: "var(--primary-dark)",
                                  fontSize: "0.9rem",
                                  textAlign: "center"
                                }}
                              >
                                {points}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div
                      style={{
                        padding: "10px 12px",
                        fontSize: "0.75rem",
                        color: "var(--gray-500)",
                        display: "flex",
                        gap: "1rem",
                        flexWrap: "wrap",
                        justifyContent: "center"
                      }}
                    >
                      {Object.keys(ESTADOS_UI).map(k => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            width: '12px', height: '12px', 
                            borderRadius: '50%', 
                            background: ESTADOS_UI[k].bg 
                          }}></span>
                          <span style={{ fontWeight: 500, color: ESTADOS_UI[k].color }}>{k}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── CONFIGURACIÓN ──────────────────────── */}
            {activeTab === "config" && config && (
              <div className="card" style={{ maxWidth: 520 }}>
                <div className="card-title">Ajustes de Horario Dinámico</div>
                <div className="card-subtitle">
                  Define las horas límite para la marcación automática (formato
                  24H).
                </div>
                <form
                  onSubmit={updateConfig}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <div className="form-group">
                    <label
                      className="form-label"
                      style={{ color: "var(--success)" }}
                    >
                      Hora límite — PUNTUAL
                    </label>
                    <input
                      className="form-input"
                      type="time"
                      required
                      value={config.limite_puntual}
                      onChange={(e) =>
                        setConfig({ ...config, limite_puntual: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label
                      className="form-label"
                      style={{ color: "var(--info)" }}
                    >
                      Hora límite — PRESENTE
                    </label>
                    <input
                      className="form-input"
                      type="time"
                      required
                      value={config.limite_presente}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          limite_presente: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label
                      className="form-label"
                      style={{ color: "var(--warning)" }}
                    >
                      Hora límite — TARDE
                    </label>
                    <input
                      className="form-input"
                      type="time"
                      required
                      value={config.limite_tarde}
                      onChange={(e) =>
                        setConfig({ ...config, limite_tarde: e.target.value })
                      }
                    />
                  </div>
                  <div
                    className="form-group"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      padding: "0.5rem",
                      background: "#f8fafc",
                      borderRadius: "4px",
                    }}
                    onClick={() =>
                      setConfig({
                        ...config,
                        permitir_falto: !config.permitir_falto,
                      })
                    }
                  >
                    <input
                      type="checkbox"
                      checked={config.permitir_falto}
                      readOnly
                      style={{ cursor: "pointer" }}
                    />
                    <span>
                      Permitir marcar INASISTENCIA (Falto) desde el móvil
                      después del límite.
                    </span>
                  </div>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? <div className="spinner" /> : "Guardar Ajustes"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
