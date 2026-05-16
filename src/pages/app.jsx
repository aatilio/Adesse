import { useState, useCallback } from "react";
import DataManager from "../components/econometrics/DataManager";
import ModelConfig from "../components/econometrics/ModelConfig";
import ResultsPanel from "../components/econometrics/ResultsPanel";
import "../components/econometrics/econometrics.css";
import { Upload, BarChart3, Settings2, ArrowLeft } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function EconometricsPage({ onBack }) {
  const [headers, setHeaders] = useState([]);
  const [aliases, setAliases] = useState({});
  const [rows, setRows] = useState([]);
  const [depVar, setDepVar] = useState("");
  const [indepVars, setIndepVars] = useState([]);
  const [confidence, setConfidence] = useState(0.95);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0); // 0=data, 1=config, 2=results

  const displayName = useCallback((h) => aliases[h] || h, [aliases]);

  const handleDataLoaded = useCallback((newHeaders, newRows, stay = false) => {
    setHeaders(newHeaders);
    setRows(newRows);
    const a = {};
    newHeaders.forEach((h) => (a[h] = h));
    setAliases(a);
    setDepVar("");
    setIndepVars([]);
    setResults(null);
    setError("");
    if (!stay) {
      setActiveStep(1);
    }
  }, []);

  const runModel = async () => {
    if (!depVar || indepVars.length === 0) {
      setError("Selecciona variable dependiente y al menos una independiente.");
      return;
    }
    const n = rows.length;
    const k = indepVars.length;
    if (n <= k + 1) {
      setError(`Grados de libertad insuficientes: n=${n}, k+1=${k + 1}. Necesitas al menos ${k + 2} observaciones.`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const depIdx = headers.indexOf(depVar);
      const payload = {
        y: { name: displayName(depVar), data: rows.map((r) => r[depIdx]) },
        x_vars: indepVars.map((v) => {
          const idx = headers.indexOf(v);
          return { name: displayName(v), data: rows.map((r) => r[idx]) };
        }),
        confidence,
      };

      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const targetUrl = isLocal ? "http://localhost:8000/api/calculate" : `${API_URL}/api/calculate`;

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Respuesta inválida del servidor"); }
      if (!res.ok) throw new Error(data?.detail || "Error del servidor");
      setResults(data);
      setActiveStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { icon: Upload, label: "Datos" },
    { icon: Settings2, label: "Modelo" },
    { icon: BarChart3, label: "Resultados" },
  ];

  return (
    <div className="eco-page">
      <div className="eco-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {onBack && (
            <button className="eco-back-btn" onClick={onBack} title="Volver">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="eco-title">Regresión Econométrica</h1>
            <p className="eco-subtitle">MCO con diagnóstico de heterocedasticidad</p>
          </div>
        </div>
        <div className="eco-stepper">
          {steps.map((s, i) => (
            <button
              key={i}
              className={`eco-step ${activeStep === i ? "active" : ""} ${i < activeStep ? "done" : ""}`}
              onClick={() => {
                if (i === 0) setActiveStep(0);
                else if (i === 1 && headers.length > 0) setActiveStep(1);
                else if (i === 2 && results) setActiveStep(2);
              }}
              disabled={i === 1 && headers.length === 0 || i === 2 && !results}
            >
              <s.icon size={16} />
              <span className="eco-step-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="eco-body">
        {error && (
          <div className="eco-error">
            <span>⚠️</span> {error}
            <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}>×</button>
          </div>
        )}

        {activeStep === 0 && (
          <DataManager
            headers={headers}
            aliases={aliases}
            rows={rows}
            onDataLoaded={handleDataLoaded}
            onAliasChange={(key, val) => setAliases((p) => ({ ...p, [key]: val }))}
            onRowsChange={setRows}
            onHeadersChange={setHeaders}
          />
        )}

        {activeStep === 1 && (
          <ModelConfig
            headers={headers}
            aliases={aliases}
            displayName={displayName}
            depVar={depVar}
            setDepVar={setDepVar}
            indepVars={indepVars}
            setIndepVars={setIndepVars}
            confidence={confidence}
            setConfidence={setConfidence}
            onRun={runModel}
            loading={loading}
            rowCount={rows.length}
          />
        )}

        {activeStep === 2 && results && (
          <ResultsPanel
            results={results}
            depVarName={displayName(depVar)}
            indepVarNames={indepVars.map(displayName)}
            confidence={confidence}
          />
        )}
      </div>
    </div>
  );
}
