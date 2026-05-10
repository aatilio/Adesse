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
  Search,
  Download,
  FileSpreadsheet,
  Check,
  Library,
  User,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../api/client";
import { ROL } from "../constants/roles";
import { toast } from "../components/Toast";
import appLogo from "../assets/ac-d.svg";
import UserMenu from "../components/UserMenu";
import Footer from "../components/Footer";
import QrGenerator from "../components/QrGenerator";
import AttendanceTable from "../components/AttendanceTable";
import ExcelIcon from "../assets/excel.svg";

export default function TeacherPage({ user, onLogout }) {
  // ── Course-level state ──────────────────────────────────
  const [cursos, setCursos] = useState([]);
  const [cursoActivo, setCursoActivo] = useState(null);
  const [showNewCurso, setShowNewCurso] = useState(false);
  const [editingCurso, setEditingCurso] = useState(null);
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
  const [estadosDB, setEstadosDB] = useState([]);

  // ── New class scheduling ────────────────────────────────
  const [newClaseName, setNewClaseName] = useState("");
  const [newClaseDate, setNewClaseDate] = useState("");
  const [showLimits, setShowLimits] = useState(false);
  const [limPuntual, setLimPuntual] = useState("");
  const [limPresente, setLimPresente] = useState("");
  const [limTarde, setLimTarde] = useState("");
  const [permitirFalto, setPermitirFalto] = useState(true);
  const [showAddSesion, setShowAddSesion] = useState(false);

  const [editingSesion, setEditingSesion] = useState(null);
  const [editSesionData, setEditSesionData] = useState({
    nombre_clase: "",
    fecha_programada: "",
    limite_puntual: "",
    limite_presente: "",
    limite_tarde: "",
    permitir_falto: true,
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [searchHistorial, setSearchHistorial] = useState("");

  useEffect(() => {
    if (config) {
      setLimPuntual(config.limite_puntual);
      setLimPresente(config.limite_presente);
      setLimTarde(config.limite_tarde);
      setPermitirFalto(config.permitir_falto);
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
    // Load config (suggested times)
    api
      .getConfiguracion()
      .then((res) => setConfig(res.config))
      .catch(() => {});
    // Load estados de asistencia
    api
      .getEstados()
      .then((res) => setEstadosDB(res.estados))
      .catch(() => {});
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
      api
        .getEstados()
        .then((res) => setEstadosDB(res.estados))
        .catch(() => {});
    }
  }, [activeTab, cursoActivo]);

  // ── Auto-refresh QR Token every 60s ─────────────────────
  useEffect(() => {
    let interval;
    if (sesion?.id && sesion?.activa) {
      interval = setInterval(async () => {
        try {
          const res = await api.refrescarToken(sesion.id);
          // Actualización segura de la sesión
          if (res?.sesion) {
            setSesion(res.sesion);
          }
        } catch (err) {
          console.error("Error al refrescar token:", err.message);
        }
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sesion?.id, sesion?.activa]);

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

  const updateCurso = async (e) => {
    e.preventDefault();
    if (!editingCurso || !newCursoName.trim()) return;
    try {
      const { curso } = await api.updateCurso(editingCurso.id, {
        nombre: newCursoName.trim(),
      });
      setCursos((prev) => prev.map((c) => (c.id === curso.id ? curso : c)));
      if (cursoActivo?.id === curso.id) setCursoActivo(curso);
      setNewCursoName("");
      setEditingCurso(null);
      toast.success("Curso actualizado");
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
        fecha_programada: new Date(newClaseDate).toISOString(),
        // Always send limits to snapshot them into the session, making it independent
        limite_puntual: limPuntual || undefined,
        limite_presente: limPresente || undefined,
        limite_tarde: limTarde || undefined,
        permitir_falto: permitirFalto,
      });
      const res = await api.getCursoSesiones(cursoActivo.id);
      setSesionesProgr(res.sesiones);
      setNewClaseName("");
      setNewClaseDate("");
      setShowLimits(false);
      setShowAddSesion(false);
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
      const MM = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      formattedDate = `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
    } else if (sesion.fecha_inicio) {
      const d = new Date(sesion.fecha_inicio);
      const yyyy = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      formattedDate = `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
    }

    setEditSesionData({
      nombre_clase: sesion.nombre_clase || "",
      fecha_programada: formattedDate,
      limite_puntual: sesion.limite_puntual || config?.limite_puntual || "",
      limite_presente: sesion.limite_presente || config?.limite_presente || "",
      limite_tarde: sesion.limite_tarde || config?.limite_tarde || "",
      permitir_falto: sesion.permitir_falto ?? config?.permitir_falto ?? true,
    });
  };

  const saveEditedSesion = async (e) => {
    e.preventDefault();
    if (!editSesionData.nombre_clase.trim() || !editSesionData.fecha_programada)
      return;
    try {
      await api.updateSesion(editingSesion, {
        nombre_clase: editSesionData.nombre_clase.trim(),
        fecha_programada: new Date(
          editSesionData.fecha_programada,
        ).toISOString(),
        limite_puntual: editSesionData.limite_puntual,
        limite_presente: editSesionData.limite_presente,
        limite_tarde: editSesionData.limite_tarde,
        permitir_falto: editSesionData.permitir_falto,
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
      await api.terminarSesion(sesion.id);
      setSesion(null);
      setAsistencias([]);
      toast.info("Sesión terminada y guardada.");
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

  // Build ESTADOS_UI dynamically from database
  const ESTADOS_UI = useMemo(() => {
    const map = {};
    estadosDB.forEach((e) => {
      map[e.nombre] = {
        bg: e.color,
        color: "#fff",
        puntuacion: parseFloat(e.puntuacion),
      };
    });
    return map;
  }, [estadosDB]);

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

  // ── Export historial to Excel ────────────────────────────
  const exportToExcel = () => {
    if (
      !cursoActivo ||
      estudiantesCurso.length === 0 ||
      clasesColumns.length === 0
    ) {
      toast.error("No hay datos para exportar");
      return;
    }

    // Build header row: CUI | Nombre | date1 | date2 | ... | Puntuación
    const headers = [
      "CUI",
      "Nombre",
      ...clasesColumns.map((c) => c.label),
      "Puntuación",
    ];

    // Build data rows
    const rows = estudiantesCurso.map((est) => {
      const recs = historialGen.filter((h) => h.estudiante_id === est.id);
      const points = recs.reduce((acc, h) => {
        return acc + (parseFloat(h.puntuacion) || 0);
      }, 0);

      const sesionValues = clasesColumns.map((c) => {
        const r = recs.find((h) => h.sesion_id === c.id);
        return r ? parseFloat(r.puntuacion) || 0 : "";
      });

      return [est.codigo, est.nombre_completo, ...sesionValues, points];
    });

    // Create workbook
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = [
      { wch: 12 }, // CUI
      { wch: 35 }, // Nombre
      ...clasesColumns.map(() => ({ wch: 14 })),
      { wch: 12 }, // Puntuación
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencias");

    // Generate filename with course name and date
    const today = new Date().toISOString().slice(0, 10);
    const safeName = cursoActivo.nombre
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "")
      .trim();
    XLSX.writeFile(wb, `Asistencias_${safeName}_${today}.xlsx`);
    toast.success("Archivo Excel descargado");
  };

  return (
    <div className="app-shell">
      {/* ── Modal Confirmar Eliminar Sesión ──────────── */}
      {confirmDeleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "2rem",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
              animation: "slideIn 0.2s ease",
            }}
          >
            <div
              style={{
                fontSize: "2.5rem",
                textAlign: "center",
                marginBottom: "0.75rem",
              }}
            >
              🗑️
            </div>
            <h3
              style={{
                margin: "0 0 0.5rem",
                color: "var(--gray-900)",
                textAlign: "center",
                fontSize: "1.1rem",
                fontWeight: 700,
              }}
            >
              ¿Eliminar esta clase?
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--gray-500)",
                textAlign: "center",
                margin: "0 0 1.5rem",
                lineHeight: 1.6,
              }}
            >
              Esta acción es{" "}
              <strong style={{ color: "var(--danger)" }}>irreversible</strong>.
              <br />
              Se eliminarán también todos los registros de asistencia asociados
              a esta clase.
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
        {/* Left Side: Logo & App Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img
            src={appLogo}
            alt="Logo"
            style={{ width: "32px", height: "auto" }}
          />
          <div>
            <div style={{ padding: 0 }}>
              <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                Adese
              </h1>
            </div>
          </div>
        </div>

        {/* Right Side: User Menu Dropdown */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <UserMenu
            user={user}
            roleLabel={
              user.rol === ROL.ADMINISTRADOR ? "Administrador" : "Admin"
            }
            onLogout={onLogout}
            extraOptions={
              viewMode === "curso"
                ? [
                    {
                      label: "Monitor en Vivo",
                      icon: Radio,
                      onClick: () => setActiveTab("vivo"),
                      active: activeTab === "vivo",
                    },
                    {
                      label: "Gestión de Clases",
                      icon: Calendar,
                      onClick: () => setActiveTab("clases"),
                      active: activeTab === "clases",
                    },
                    {
                      label: "Historial y Exportar",
                      icon: History,
                      onClick: () => setActiveTab("historial"),
                      active: activeTab === "historial",
                    },
                    {
                      label: "Ajustes del Curso",
                      icon: Settings,
                      onClick: () => setActiveTab("config"),
                      active: activeTab === "config",
                    },
                  ]
                : []
            }
          />
        </div>
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Library size={24} style={{ color: "var(--primary)" }} />
              <h2
                style={{
                  fontSize: "1.2rem",
                  margin: 0,
                  color: "var(--gray-800)",
                }}
              >
                Mis Cursos
              </h2>
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setViewMode("usuarios")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "white",
                color: "var(--gray-700)",
                border: "1px solid var(--gray-300)",
                fontWeight: "600",
                width: "auto",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <Users size={14} /> Usuarios
            </button>

          </div>

          {/* ── Add/Edit Course Modal ──────────────────────── */}
          {(showNewCurso || editingCurso) && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
              }}
              onClick={() => {
                setShowNewCurso(false);
                setEditingCurso(null);
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: "16px",
                  width: "100%",
                  maxWidth: "420px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--gray-100)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "var(--gray-50)",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "1rem",
                      color: "var(--gray-800)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {editingCurso ? (
                      <Edit size={18} style={{ color: "var(--primary)" }} />
                    ) : (
                      <Plus size={18} style={{ color: "var(--primary)" }} />
                    )}
                    {editingCurso ? "Editar Curso" : "Nuevo Curso"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowNewCurso(false);
                      setEditingCurso(null);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--gray-400)",
                      padding: "4px",
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={editingCurso ? updateCurso : crearCurso}>
                  <div style={{ padding: "20px" }}>
                    <div className="form-group">
                      <label
                        className="form-label"
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--gray-500)",
                          marginBottom: "4px",
                        }}
                      >
                        Nombre del Curso
                      </label>
                      <input
                        className="form-input"
                        autoFocus
                        value={newCursoName}
                        onChange={(e) => setNewCursoName(e.target.value)}
                        placeholder="Ej: Programación III"
                        required
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "14px 20px",
                      borderTop: "1px solid var(--gray-100)",
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "0.5rem",
                      background: "var(--gray-50)",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setShowNewCurso(false);
                        setEditingCurso(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingCurso ? "Guardar Cambios" : "Crear Curso"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

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
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewCursoName(c.nombre);
                          setEditingCurso(c);
                        }}
                        style={{ color: "var(--gray-500)", padding: "4px" }}
                        title="Editar curso"
                      >
                        <Edit size={16} />
                      </button>
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

              {/* ── Sketch Card: Crear Curso ────────────────── */}
              <div
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.4)",
                  border: "2px dashed var(--gray-300)",
                  minHeight: "140px",
                  margin: 0,
                  transition: "all 0.2s ease",
                  boxShadow: "none",
                }}
                onClick={() => {
                  setNewCursoName("");
                  setShowNewCurso(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.background = "var(--primary-bg)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--gray-300)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.4)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "var(--gray-100)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--gray-500)",
                    transition: "all 0.2s ease",
                  }}
                  className="sketch-plus-icon"
                >
                  <Plus size={24} />
                </div>
                <span
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "600",
                    color: "var(--gray-500)",
                  }}
                >
                  Añadir Curso
                </span>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === "usuarios" ? (
        /* ══════ VISTA USUARIOS ══════════════════════ */
        <UsersView onBack={() => setViewMode("dashboard")} cursos={cursos} />
      ) : (
        <>
          {/* COURSE VIEW: Header & Tabs */}
          <div
            className="teacher-course-toolbar"
            style={{ marginBottom: "0.5rem" }}
          >
            <h2
              className="teacher-course-title"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "1.1rem",
              }}
            >
              <span style={{ color: "var(--gray-500)", fontWeight: 500 }}>
                Asistencias del curso de:
              </span>
              <span
                className="teacher-course-title-text"
                style={{ color: "var(--primary)", fontWeight: 800 }}
              >
                {cursoActivo?.nombre}
              </span>
            </h2>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid var(--gray-200)",
              background: "rgba(255,255,255,0.3)",
              backdropFilter: "blur(10px)",
              padding: "0 1rem",
              gap: "1rem",
            }}
          >
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setViewMode("dashboard")}
              style={{
                color: "var(--gray-600)",
                fontSize: "0.8rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                // backgroundColor: "",
                padding: "8px 12px",
                borderRight: "1px solid var(--gray-200)",
                borderRadius: "12px",
                height: "100%",
              }}
            >
              « Volver a Cursos
            </button>

            <div
              className="tabs"
              style={{ borderBottom: "none", padding: 0, gap: "1.5rem" }}
            >
              <button
                className={`tab ${activeTab === "vivo" ? "active" : ""}`}
                onClick={() => setActiveTab("vivo")}
                style={{ padding: "12px 0" }}
              >
                <Radio size={16} /> Monitor
              </button>
              <button
                className={`tab ${activeTab === "clases" ? "active" : ""}`}
                onClick={() => setActiveTab("clases")}
                style={{ padding: "12px 0" }}
              >
                <Calendar size={16} /> Clases
              </button>
              <button
                className={`tab ${activeTab === "historial" ? "active" : ""}`}
                onClick={() => setActiveTab("historial")}
                style={{ padding: "12px 0" }}
              >
                <History size={16} /> Historial
              </button>
              {/* <button
                className={`tab ${activeTab === "config" ? "active" : ""}`}
                onClick={() => setActiveTab("config")}
                style={{ padding: "12px 0" }}
              >
                <Settings size={16} /> Ajustes
              </button> */}
            </div>
          </div>

          <div className="page-body" style={{ width: "100%" }}>
            {/* ─── MONITOR EN VIVO ─────────────────────── */}
            {activeTab === "vivo" &&
              (!sesion || sesion.curso_id !== cursoActivo?.id ? (
                <div
                  className="card"
                  style={{
                    maxWidth: 480,
                    margin: "0 auto",
                    textAlign: "center",
                    padding: "3rem 1.5rem",
                    border: "2px dashed var(--gray-200)",
                    background: "var(--gray-50)",
                    borderRadius: "24px",
                  }}
                >
                  <Calendar
                    size={48}
                    style={{
                      margin: "0 auto 1.5rem",
                      color: "var(--primary)",
                      opacity: 0.5,
                    }}
                  />
                  <div
                    className="card-title"
                    style={{ justifyContent: "center", fontSize: "1.2rem" }}
                  >
                    No hay una sesión activa
                  </div>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--gray-500)",
                      marginBottom: "2rem",
                      lineHeight: "1.6",
                    }}
                  >
                    Para generar el código QR y recibir asistencias, debes
                    iniciar una clase programada desde la pestaña de{" "}
                    <strong>Clases</strong>.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab("clases")}
                    style={{
                      margin: "0 auto",
                      width: "auto",
                      padding: "0.8rem 2.5rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    <Calendar size={16} style={{ marginRight: "8px" }} /> Ir a
                    Mis Clases
                  </button>
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
                        <strong>{sesion?.nombre_clase || "Cargando..."}</strong>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm session-chip-end"
                        onClick={cerrarSesion}
                      >
                        <StopCircle size={13} /> Terminar
                      </button>
                    </div>
                    <div className="card teacher-qr-card">
                      <QrGenerator sesion={sesion} />
                    </div>
                  </div>
                  <div className="card teacher-attendance-card">
                    <AttendanceTable
                      sesionId={sesion?.id}
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
                          updateEstudiante(est.id, "codigo", e.target.value)
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
                  <Calendar size={18} /> Sesiones Programadas
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddSesion(true)}
                  >
                    <Plus size={14} /> Programar Clase
                  </button>
                </div>

                {/* ── Add Clase Modal ──────────────────────── */}
                {showAddSesion && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 9999,
                      background: "rgba(0,0,0,0.45)",
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                    }}
                    onClick={() => setShowAddSesion(false)}
                  >
                    <div
                      style={{
                        background: "white",
                        borderRadius: "16px",
                        width: "100%",
                        maxWidth: "480px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                        overflow: "hidden",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          padding: "16px 20px",
                          borderBottom: "1px solid var(--gray-100)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "var(--gray-50)",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1rem",
                            color: "var(--gray-800)",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Plus size={18} style={{ color: "var(--primary)" }} />
                          Programar Nueva Clase
                        </h3>
                        <button
                          onClick={() => setShowAddSesion(false)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--gray-400)",
                            padding: "4px",
                          }}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <form onSubmit={programarClase} id="add-clase-form">
                        <div
                          style={{
                            padding: "20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "0.75rem",
                            }}
                          >
                            <div
                              className="form-group"
                              style={{ marginTop: 0 }}
                            >
                              <label
                                className="form-label"
                                style={{
                                  fontSize: "0.8rem",
                                  color: "var(--gray-500)",
                                  marginBottom: "4px",
                                }}
                              >
                                Nombre de la Clase
                              </label>
                              <input
                                className="form-input"
                                value={newClaseName}
                                onChange={(e) =>
                                  setNewClaseName(e.target.value)
                                }
                                placeholder="Ej: Sesión 1"
                                required
                              />
                            </div>
                            <div
                              className="form-group"
                              style={{ marginTop: 0 }}
                            >
                              <label
                                className="form-label"
                                style={{
                                  fontSize: "0.8rem",
                                  color: "var(--gray-500)",
                                  marginBottom: "4px",
                                }}
                              >
                                Fecha y Hora
                              </label>
                              <input
                                className="form-input"
                                type="datetime-local"
                                value={newClaseDate}
                                onChange={(e) =>
                                  setNewClaseDate(e.target.value)
                                }
                                required
                              />
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "12px",
                              background: "#f8fafc",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                                color: "var(--gray-700)",
                                cursor: "pointer",
                                marginBottom: "8px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={showLimits}
                                onChange={(e) =>
                                  setShowLimits(e.target.checked)
                                }
                              />
                              Horario límite personalizado
                            </label>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: "0.5rem",
                                opacity: showLimits ? 1 : 0.5,
                                pointerEvents: showLimits ? "auto" : "none",
                              }}
                            >
                              <div
                                className="form-group"
                                style={{ marginTop: 0 }}
                              >
                                <label
                                  className="form-label"
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#059669",
                                  }}
                                >
                                  Puntual
                                </label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={limPuntual}
                                  onChange={(e) =>
                                    setLimPuntual(e.target.value)
                                  }
                                  style={{ padding: "4px 8px" }}
                                />
                              </div>
                              <div
                                className="form-group"
                                style={{ marginTop: 0 }}
                              >
                                <label
                                  className="form-label"
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#2563eb",
                                  }}
                                >
                                  Presente
                                </label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={limPresente}
                                  onChange={(e) =>
                                    setLimPresente(e.target.value)
                                  }
                                  style={{ padding: "4px 8px" }}
                                />
                              </div>
                              <div
                                className="form-group"
                                style={{ marginTop: 0 }}
                              >
                                <label
                                  className="form-label"
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#d97706",
                                  }}
                                >
                                  Tarde
                                </label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={limTarde}
                                  onChange={(e) => setLimTarde(e.target.value)}
                                  style={{ padding: "4px 8px" }}
                                />
                              </div>
                            </div>

                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.8rem",
                                color: "var(--gray-600)",
                                cursor: "pointer",
                                marginTop: "12px",
                                paddingTop: "10px",
                                borderTop: "1px solid #e2e8f0",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={permitirFalto}
                                onChange={(e) =>
                                  setPermitirFalto(e.target.checked)
                                }
                              />
                              Permitir marcar INASISTENCIA (Falto) desde el
                              móvil
                            </label>
                          </div>
                        </div>
                      </form>

                      <div
                        style={{
                          padding: "14px 20px",
                          borderTop: "1px solid var(--gray-100)",
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "0.5rem",
                          background: "var(--gray-50)",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setShowAddSesion(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          form="add-clase-form"
                          className="btn btn-primary"
                          disabled={!newClaseName.trim() || !newClaseDate}
                        >
                          Programar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Edit Clase Modal ──────────────────────── */}
                {editingSesion && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 9999,
                      background: "rgba(0,0,0,0.45)",
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                    }}
                    onClick={() => setEditingSesion(null)}
                  >
                    <div
                      style={{
                        background: "white",
                        borderRadius: "16px",
                        width: "100%",
                        maxWidth: "480px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                        overflow: "hidden",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div
                        style={{
                          padding: "16px 20px",
                          borderBottom: "1px solid var(--gray-100)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "var(--gray-50)",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1rem",
                            color: "var(--gray-800)",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Edit size={18} style={{ color: "var(--primary)" }} />
                          Editar Clase
                        </h3>
                        <button
                          onClick={() => setEditingSesion(null)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--gray-400)",
                            padding: "4px",
                          }}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Body */}
                      <form onSubmit={saveEditedSesion} id="edit-clase-form">
                        <div
                          style={{
                            padding: "20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "0.75rem",
                            }}
                          >
                            <div
                              className="form-group"
                              style={{ marginTop: 0 }}
                            >
                              <label
                                className="form-label"
                                style={{
                                  fontSize: "0.8rem",
                                  color: "var(--gray-500)",
                                  marginBottom: "4px",
                                }}
                              >
                                Nombre
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                value={editSesionData.nombre_clase}
                                onChange={(e) =>
                                  setEditSesionData({
                                    ...editSesionData,
                                    nombre_clase: e.target.value,
                                  })
                                }
                                style={{ fontSize: "0.9rem" }}
                                required
                              />
                            </div>
                            <div
                              className="form-group"
                              style={{ marginTop: 0 }}
                            >
                              <label
                                className="form-label"
                                style={{
                                  fontSize: "0.8rem",
                                  color: "var(--gray-500)",
                                  marginBottom: "4px",
                                }}
                              >
                                Fecha y Hora
                              </label>
                              <input
                                type="datetime-local"
                                className="form-input"
                                value={editSesionData.fecha_programada}
                                onChange={(e) =>
                                  setEditSesionData({
                                    ...editSesionData,
                                    fecha_programada: e.target.value,
                                  })
                                }
                                style={{ fontSize: "0.9rem" }}
                                required
                              />
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "12px",
                              background: "#f8fafc",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              marginTop: "4px",
                            }}
                          >
                            <label
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--gray-700)",
                                fontWeight: "bold",
                                marginBottom: "8px",
                                display: "block",
                              }}
                            >
                              Límites de Tiempo Personalizados
                            </label>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: "0.5rem",
                              }}
                            >
                              <div
                                className="form-group"
                                style={{ marginTop: 0 }}
                              >
                                <label
                                  className="form-label"
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#059669",
                                    marginBottom: "2px",
                                  }}
                                >
                                  Puntual
                                </label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={editSesionData.limite_puntual}
                                  onChange={(e) =>
                                    setEditSesionData({
                                      ...editSesionData,
                                      limite_puntual: e.target.value,
                                    })
                                  }
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.85rem",
                                  }}
                                />
                              </div>
                              <div
                                className="form-group"
                                style={{ marginTop: 0 }}
                              >
                                <label
                                  className="form-label"
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#2563eb",
                                    marginBottom: "2px",
                                  }}
                                >
                                  Presente
                                </label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={editSesionData.limite_presente}
                                  onChange={(e) =>
                                    setEditSesionData({
                                      ...editSesionData,
                                      limite_presente: e.target.value,
                                    })
                                  }
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.85rem",
                                  }}
                                />
                              </div>
                              <div
                                className="form-group"
                                style={{ marginTop: 0 }}
                              >
                                <label
                                  className="form-label"
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#d97706",
                                    marginBottom: "2px",
                                  }}
                                >
                                  Tarde
                                </label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={editSesionData.limite_tarde}
                                  onChange={(e) =>
                                    setEditSesionData({
                                      ...editSesionData,
                                      limite_tarde: e.target.value,
                                    })
                                  }
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.85rem",
                                  }}
                                />
                              </div>
                            </div>

                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.8rem",
                                color: "var(--gray-600)",
                                cursor: "pointer",
                                marginTop: "12px",
                                paddingTop: "10px",
                                borderTop: "1px solid #e2e8f0",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={editSesionData.permitir_falto}
                                onChange={(e) =>
                                  setEditSesionData({
                                    ...editSesionData,
                                    permitir_falto: e.target.checked,
                                  })
                                }
                              />
                              Permitir marcar INASISTENCIA (Falto) desde el
                              móvil
                            </label>
                          </div>
                        </div>
                      </form>

                      {/* Footer */}
                      <div
                        style={{
                          padding: "14px 20px",
                          borderTop: "1px solid var(--gray-100)",
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "0.5rem",
                          background: "var(--gray-50)",
                        }}
                      >
                        <button
                          className="btn btn-ghost"
                          onClick={() => setEditingSesion(null)}
                          style={{ height: "36px" }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          form="edit-clase-form"
                          className="btn btn-primary"
                          style={{ height: "36px" }}
                        >
                          Guardar Cambios
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "1rem",
                            padding: "0.75rem 1rem",
                            background: s.activa
                              ? "var(--success-bg)"
                              : "var(--gray-50)",
                            borderRadius: "12px",
                            border: `1px solid ${s.activa ? "var(--success)" : "var(--gray-200)"}`,
                            marginBottom: "0.75rem",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div
                            style={{ display: "flex", flexDirection: "column" }}
                          >
                            <strong
                              style={{
                                fontSize: "0.95rem",
                                color: "var(--gray-900)",
                              }}
                            >
                              {s.nombre_clase}
                            </strong>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--gray-500)",
                                fontWeight: "500",
                              }}
                            >
                              {s.fecha_programada
                                ? fmtFecha(s.fecha_programada)
                                : fmtFecha(s.fecha_inicio)}
                              {s.total_asistencias > 0 &&
                                ` • ${s.total_asistencias} asistencias`}
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
                                  background: "var(--success)",
                                  color: "white",
                                  fontWeight: "700",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                EN VIVO
                              </span>
                            ) : s.faltas_procesadas ? (
                              <span
                                className="badge"
                                style={{
                                  background: "var(--gray-300)",
                                  color: "var(--gray-700)",
                                  fontWeight: "600",
                                  fontSize: "0.7rem",
                                }}
                              >
                                FINALIZADA
                              </span>
                            ) : (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => activarSesion(s.id)}
                                style={{ borderRadius: "8px" }}
                              >
                                <Play size={12} fill="currentColor" /> Iniciar
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => openEditForm(s)}
                              style={{
                                color: "var(--gray-600)",
                                padding: "4px",
                              }}
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <div className="card-title">Asistencias</div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "nowrap",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "280px",
                      }}
                    >
                      <Search
                        size={16}
                        style={{
                          position: "absolute",
                          left: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--gray-400)",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Buscar alumno o código..."
                        className="form-input"
                        value={searchHistorial}
                        onChange={(e) => setSearchHistorial(e.target.value)}
                        style={{
                          paddingLeft: "38px",
                          paddingRight: "30px",
                          height: "38px",
                          fontSize: "0.85rem",
                        }}
                      />
                      {searchHistorial && (
                        <button
                          onClick={() => setSearchHistorial("")}
                          style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            color: "var(--gray-400)",
                            cursor: "pointer",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {historialGen.length > 0 && (
                      <button
                        onClick={exportToExcel}
                        className="btn"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          height: "32px",
                          fontSize: "0.78rem",
                          whiteSpace: "nowrap",
                          padding: "0 12px",
                          background: "white",
                          color: "#1D6F42",
                          border: "1px solid #1D6F42",
                          borderRadius: "8px",
                          fontWeight: "600",
                          width: "auto",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f0fdf4")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "white")
                        }
                      >
                        <img
                          src={ExcelIcon}
                          alt="Excel"
                          width="16"
                          height="16"
                        />
                        Exportar Excel
                      </button>
                    )}
                  </div>
                </div>

                {historialGen.length === 0 ? (
                  <p className="text-muted" style={{ marginTop: "1rem" }}>
                    No hay clases o registros aún para este curso.
                  </p>
                ) : (
                  <div
                    className="table-responsive"
                    style={{ marginTop: "1rem" }}
                  >
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th
                            className="sticky-column"
                            style={{ textAlign: "left" }}
                          >
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
                        {estudiantesCurso
                          .filter(
                            (est) =>
                              est.nombre_completo
                                .toLowerCase()
                                .includes(searchHistorial.toLowerCase()) ||
                              est.codigo
                                .toLowerCase()
                                .includes(searchHistorial.toLowerCase()),
                          )
                          .map((est, i) => {
                            const recs = historialGen.filter(
                              (h) => h.estudiante_id === est.id,
                            );
                            const points = recs.reduce((acc, h) => {
                              return acc + (parseFloat(h.puntuacion) || 0);
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
                                  const textColor = ui
                                    ? ui.color
                                    : "var(--gray-300)";

                                  return (
                                    <td
                                      key={c.id}
                                      style={{
                                        padding: "6px",
                                        borderLeft: "1px solid var(--gray-100)",
                                        background: "transparent",
                                        verticalAlign: "middle",
                                      }}
                                    >
                                      <div
                                        style={{
                                          background: bgColor,
                                          borderRadius: "16px",
                                          padding: status ? "2px 6px" : "2px",
                                          display: "flex",
                                          justifyContent: "center",
                                          minWidth: "85px",
                                          margin: "0 auto",
                                        }}
                                      >
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
                                                background: "white",
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
                                    textAlign: "center",
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
                        justifyContent: "center",
                      }}
                    >
                      {Object.keys(ESTADOS_UI).map((k) => (
                        <div
                          key={k}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              background: ESTADOS_UI[k].bg,
                            }}
                          ></span>
                          <span
                            style={{
                              fontWeight: 500,
                              color: ESTADOS_UI[k].color,
                            }}
                          >
                            {k}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── CONFIGURACIÓN ──────────────────────── */}
            {activeTab === "config" && config && (
              <>
                <div className="card" style={{ maxWidth: 520 }}>
                  <div className="card-title">Ajustes de Horario Dinámico</div>
                  <div className="card-subtitle">
                    Define las horas límite para la marcación automática
                    (formato 24H).
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
                          setConfig({
                            ...config,
                            limite_puntual: e.target.value,
                          })
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
                      {loading ? (
                        <div className="spinner" />
                      ) : (
                        "Guardar Ajustes"
                      )}
                    </button>
                  </form>
                </div>

                {/* ── Estados de Asistencia CRUD ──────────── */}
                <div
                  className="card"
                  style={{ maxWidth: 620, marginTop: "1.5rem" }}
                >
                  <div className="card-title">Estados de Asistencia</div>
                  <div className="card-subtitle">
                    Administra los tipos de asistencia, sus colores y
                    puntuación.
                  </div>
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    {estadosDB.map((est) => (
                      <div
                        key={est.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "8px 12px",
                          background: "#f8fafc",
                          borderRadius: "8px",
                          border: "1px solid var(--gray-100)",
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          type="color"
                          value={est.color}
                          onChange={(e) =>
                            setEstadosDB((prev) =>
                              prev.map((s) =>
                                s.id === est.id
                                  ? { ...s, color: e.target.value }
                                  : s,
                              ),
                            )
                          }
                          style={{
                            width: "36px",
                            height: "36px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        />
                        <input
                          className="form-input"
                          value={est.nombre}
                          onChange={(e) =>
                            setEstadosDB((prev) =>
                              prev.map((s) =>
                                s.id === est.id
                                  ? { ...s, nombre: e.target.value }
                                  : s,
                              ),
                            )
                          }
                          style={{
                            flex: 1,
                            minWidth: "120px",
                            height: "36px",
                            fontSize: "0.85rem",
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--gray-500)",
                            }}
                          >
                            Pts:
                          </label>
                          <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            min="0"
                            max="9.99"
                            value={est.puntuacion}
                            onChange={(e) =>
                              setEstadosDB((prev) =>
                                prev.map((s) =>
                                  s.id === est.id
                                    ? { ...s, puntuacion: e.target.value }
                                    : s,
                                ),
                              )
                            }
                            style={{
                              width: "70px",
                              height: "36px",
                              fontSize: "0.85rem",
                              textAlign: "center",
                            }}
                          />
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{
                            height: "36px",
                            fontSize: "0.78rem",
                            padding: "0 12px",
                          }}
                          onClick={async () => {
                            try {
                              await api.updateEstado(est.id, {
                                nombre: est.nombre,
                                color: est.color,
                                puntuacion: parseFloat(est.puntuacion),
                              });
                              toast.success(`"${est.nombre}" actualizado`);
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{
                            height: "36px",
                            fontSize: "0.78rem",
                            padding: "0 10px",
                            color: "var(--error)",
                            border: "1px solid var(--error)",
                          }}
                          onClick={async () => {
                            if (
                              !confirm(`¿Eliminar el estado "${est.nombre}"?`)
                            )
                              return;
                            try {
                              await api.deleteEstado(est.id);
                              setEstadosDB((prev) =>
                                prev.filter((s) => s.id !== est.id),
                              );
                              toast.info(`"${est.nombre}" eliminado`);
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add new estado */}
                    <button
                      className="btn btn-ghost"
                      style={{
                        border: "1px dashed var(--gray-300)",
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        fontSize: "0.85rem",
                        color: "var(--gray-500)",
                        padding: "10px",
                      }}
                      onClick={async () => {
                        try {
                          const { estado } = await api.crearEstado({
                            nombre: "Nuevo Estado",
                            color: "#6B7280",
                            puntuacion: 0,
                          });
                          setEstadosDB((prev) => [...prev, estado]);
                          toast.success("Estado creado. Edítalo y guarda.");
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <Plus size={16} /> Agregar Estado
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
      <Footer simple={true} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// UsersView — Gestión de usuarios
// ══════════════════════════════════════════════════════════════
function UsersView({ onBack, cursos }) {
  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [editData, setEditData] = useState({ codigo: "", nombre_completo: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ codigo: "", nombre_completo: "" });
  const [loadingU, setLoadingU] = useState(true);

  useEffect(() => {
    api
      .getUsuarios()
      .then((res) => setUsuarios(res.usuarios))
      .catch(() => toast.error("Error cargando usuarios"))
      .finally(() => setLoadingU(false));
  }, []);

  const filteredUsers = usuarios.filter(
    (u) =>
      u.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      u.codigo.toLowerCase().includes(search.toLowerCase()),
  );

  const openEdit = (u) => {
    setEditUser(u);
    setEditData({ codigo: u.codigo, nombre_completo: u.nombre_completo });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    try {
      await api.updateEstudiante(editUser.id, editData);
      setUsuarios((prev) =>
        prev.map((u) => (u.id === editUser.id ? { ...u, ...editData } : u)),
      );
      setEditUser(null);
      toast.success("Usuario actualizado");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteUser = async (u) => {
    if (
      !confirm(
        `¿Eliminar a "${u.nombre_completo}"? Se borrarán sus asistencias.`,
      )
    )
      return;
    try {
      await api.deleteUsuario(u.id);
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id));
      toast.info("Usuario eliminado");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    if (!newUser.codigo.trim() || !newUser.nombre_completo.trim()) return;
    try {
      const { usuario } = await api.crearUsuario({
        codigo: newUser.codigo.trim().toUpperCase(),
        nombre_completo: newUser.nombre_completo.trim(),
      });
      setUsuarios((prev) =>
        [...prev, usuario].sort((a, b) =>
          a.nombre_completo.localeCompare(b.nombre_completo),
        ),
      );
      setNewUser({ codigo: "", nombre_completo: "" });
      setShowAdd(false);
      toast.success("Usuario creado");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleCurso = async (userId, cursoId, isEnrolled) => {
    try {
      if (isEnrolled) {
        await api.removeEstudianteCurso(cursoId, userId);
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, cursos: u.cursos.filter((c) => c.id !== cursoId) }
              : u,
          ),
        );
        if (editUser?.id === userId) {
          setEditUser((prev) => ({
            ...prev,
            cursos: prev.cursos.filter((c) => c.id !== cursoId),
          }));
        }
      } else {
        await api.addEstudianteCurso(cursoId, userId);
        const curso = cursos.find((c) => c.id === cursoId);
        const nc = { id: cursoId, nombre: curso?.nombre };
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, cursos: [...u.cursos, nc] } : u,
          ),
        );
        if (editUser?.id === userId) {
          setEditUser((prev) => ({ ...prev, cursos: [...prev.cursos, nc] }));
        }
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      {/* ── Edit Modal ──────────────────────── */}
      {editUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setEditUser(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--gray-100)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--gray-50)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  color: "var(--gray-800)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Edit size={18} style={{ color: "var(--primary)" }} />
                Editar Usuario
              </h3>
              <button
                onClick={() => setEditUser(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--gray-400)",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div className="form-group">
                <label
                  className="form-label"
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--gray-500)",
                    marginBottom: "4px",
                  }}
                >
                  CUI / Código
                </label>
                <input
                  className="form-input"
                  value={editData.codigo}
                  onChange={(e) =>
                    setEditData({ ...editData, codigo: e.target.value })
                  }
                  style={{ fontSize: "0.9rem" }}
                />
              </div>
              <div className="form-group">
                <label
                  className="form-label"
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--gray-500)",
                    marginBottom: "4px",
                  }}
                >
                  Nombre Completo
                </label>
                <input
                  className="form-input"
                  value={editData.nombre_completo}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      nombre_completo: e.target.value,
                    })
                  }
                  style={{ fontSize: "0.9rem" }}
                />
              </div>

              {/* Course enrollment checkboxes */}
              <div>
                <label
                  className="form-label"
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--gray-500)",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  Cursos Matriculados
                </label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {cursos.map((c) => {
                    const enrolled = (editUser.cursos || []).some(
                      (uc) => uc.id === c.id,
                    );
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleCurso(editUser.id, c.id, enrolled)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          border: enrolled
                            ? "1.5px solid var(--primary)"
                            : "1px solid var(--gray-200)",
                          background: enrolled ? "var(--primary-bg)" : "white",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "4px",
                            flexShrink: 0,
                            border: enrolled
                              ? "2px solid var(--primary)"
                              : "2px solid var(--gray-300)",
                            background: enrolled ? "var(--primary)" : "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {enrolled && <Check size={14} color="white" />}
                        </div>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: enrolled ? "600" : "400",
                            color: enrolled
                              ? "var(--primary-dark)"
                              : "var(--gray-600)",
                          }}
                        >
                          {c.nombre}
                        </span>
                      </div>
                    );
                  })}
                  {cursos.length === 0 && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--gray-400)",
                        fontStyle: "italic",
                      }}
                    >
                      No hay cursos creados.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--gray-100)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                background: "var(--gray-50)",
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setEditUser(null)}
                style={{ height: "36px" }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={saveEdit}
                style={{ height: "36px" }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onBack}
            style={{
              padding: "6px 10px",
              background: "white",
              border: "1px solid var(--gray-200)",
            }}
          >
            « Volver
          </button>
          <h2
            style={{ fontSize: "1.2rem", margin: 0, color: "var(--gray-800)" }}
          >
            <Users
              size={20}
              style={{ verticalAlign: "middle", marginRight: "6px" }}
            />
            Gestión de Usuarios
          </h2>
          <span
            style={{
              background: "var(--primary)",
              color: "white",
              borderRadius: "20px",
              padding: "2px 10px",
              fontSize: "0.75rem",
              fontWeight: "700",
            }}
          >
            {usuarios.length}
          </span>
        </div>
        <div 
          className="responsive-filters" 
          style={{ 
            display: "flex", 
            gap: "0.75rem", 
            flexWrap: "wrap", 
            alignItems: "center",
            flex: "1",
            justifyContent: "flex-end"
          }}
        >
          <div 
            className="search-container-historial"
            style={{ 
              position: "relative",
              flex: "1 1 300px",
              maxWidth: "100%"
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--gray-400)",
                zIndex: 1,
              }}
            />
            <input
              className="form-input"
              placeholder="Buscar por nombre o CUI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: "38px",
                paddingRight: "34px",
                height: "42px",
                fontSize: "0.85rem",
                borderRadius: "10px",
                border: "1px solid var(--gray-200)",
                background: "var(--white)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--gray-400)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            className="btn btn-primary btn-add-user"
            onClick={() => setShowAdd(!showAdd)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              height: "42px",
              width: "auto",
              padding: "0 20px",
              borderRadius: "10px",
              fontWeight: "700",
              boxShadow: "0 4px 12px rgba(0, 65, 130, 0.2)",
            }}
          >
            <UserPlus size={18} /> Añadir
          </button>
        </div>
      </div>

      {/* ── Add User Modal ────────────────────────── */}
      {showAdd && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setShowAdd(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--gray-100)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--gray-50)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  color: "var(--gray-800)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <UserPlus size={18} style={{ color: "var(--primary)" }} />
                Nuevo Usuario
              </h3>
              <button
                onClick={() => setShowAdd(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--gray-400)",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={addUser}>
              <div
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div className="form-group">
                  <label
                    className="form-label"
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--gray-500)",
                      marginBottom: "4px",
                    }}
                  >
                    CUI / Código
                  </label>
                  <input
                    className="form-input"
                    placeholder="CUI / Código"
                    value={newUser.codigo}
                    onChange={(e) =>
                      setNewUser({ ...newUser, codigo: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label
                    className="form-label"
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--gray-500)",
                      marginBottom: "4px",
                    }}
                  >
                    Nombre Completo
                  </label>
                  <input
                    className="form-input"
                    placeholder="Nombre Completo"
                    value={newUser.nombre_completo}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        nombre_completo: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid var(--gray-100)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  background: "var(--gray-50)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAdd(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users list */}
      {loadingU ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <div
            className="spinner"
            style={{
              borderTopColor: "var(--primary)",
              width: 32,
              height: 32,
              margin: "0 auto",
            }}
          />
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="card"
              style={{ margin: 0, padding: "12px 16px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div
                    style={{
                      fontWeight: "700",
                      fontSize: "0.9rem",
                      color: "var(--gray-800)",
                    }}
                  >
                    {u.nombre_completo}
                    {Number(u.rol) === 1 && (
                      <span
                        style={{
                          marginLeft: "6px",
                          background: "var(--primary)",
                          color: "white",
                          borderRadius: "4px",
                          padding: "1px 6px",
                          fontSize: "0.65rem",
                          fontWeight: "600",
                        }}
                      >
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--gray-400)",
                      marginTop: "2px",
                    }}
                  >
                    {u.codigo}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      flexWrap: "wrap",
                      marginTop: "6px",
                    }}
                  >
                    {(u.cursos || []).map((c) => (
                      <span
                        key={c.id}
                        style={{
                          display: "inline-block",
                          background: "var(--primary-bg)",
                          color: "var(--primary-dark)",
                          border: "1px solid var(--primary-light, #c7d2fe)",
                          borderRadius: "12px",
                          padding: "2px 8px",
                          fontSize: "0.68rem",
                          fontWeight: "600",
                        }}
                      >
                        {c.nombre}
                      </span>
                    ))}
                    {(!u.cursos || u.cursos.length === 0) && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--gray-400)",
                          fontStyle: "italic",
                        }}
                      >
                        Sin curso
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openEdit(u)}
                    style={{ height: "32px", padding: "0 8px" }}
                    title="Editar"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteUser(u)}
                    style={{
                      height: "32px",
                      padding: "0 8px",
                      color: "var(--error)",
                    }}
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "var(--gray-400)",
              }}
            >
              No se encontraron usuarios.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
