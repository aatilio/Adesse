import { ChevronDown, Play, Loader } from "lucide-react";

export default function ModelConfig({ headers, aliases, displayName, depVar, setDepVar, indepVars, setIndepVars, confidence, setConfidence, onRun, loading, rowCount }) {
  const toggleIndep = (h) => {
    setIndepVars((prev) =>
      prev.includes(h) ? prev.filter((v) => v !== h) : [...prev, h]
    );
  };

  const availableForX = headers.filter((h) => h !== depVar);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Dependent variable */}
      <div className="eco-card">
        <div className="eco-card-title">Variable Dependiente (Y)</div>
        <p className="eco-card-desc">Selecciona la variable que deseas explicar.</p>
        <div className="eco-select-wrap">
          <select className="eco-select" value={depVar} onChange={(e) => { setDepVar(e.target.value); setIndepVars((p) => p.filter((v) => v !== e.target.value)); }}>
            <option value="">— Seleccionar —</option>
            {headers.map((h) => (
              <option key={h} value={h}>{displayName(h)}</option>
            ))}
          </select>
          <ChevronDown size={16} className="eco-select-icon" />
        </div>
      </div>

      {/* Independent variables */}
      <div className="eco-card">
        <div className="eco-card-title">Variables Independientes (X₁, X₂, …)</div>
        <p className="eco-card-desc">Marca una o más variables explicativas.</p>
        {availableForX.length === 0 ? (
          <p style={{ color: "var(--gray-400)", fontSize: "0.8rem" }}>Selecciona primero la variable Y.</p>
        ) : (
          <div className="eco-checkbox-grid">
            {availableForX.map((h) => (
              <label key={h} className={`eco-checkbox-item ${indepVars.includes(h) ? "checked" : ""}`}>
                <input type="checkbox" checked={indepVars.includes(h)} onChange={() => toggleIndep(h)} hidden />
                <span className="eco-checkbox-box">{indepVars.includes(h) && "✓"}</span>
                <span>{displayName(h)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Confidence level */}
      <div className="eco-card">
        <div className="eco-card-title">Nivel de Confianza</div>
        <div className="eco-confidence-grid">
          {[0.90, 0.95, 0.99].map((c) => (
            <button key={c} className={`eco-conf-btn ${confidence === c ? "active" : ""}`} onClick={() => setConfidence(c)}>
              {(c * 100).toFixed(0)}%
            </button>
          ))}
        </div>
      </div>

      {/* Summary & Run */}
      <div className="eco-card eco-card-accent">
        <div className="eco-summary-row">
          <span>Observaciones:</span><strong>{rowCount}</strong>
        </div>
        <div className="eco-summary-row">
          <span>Y:</span><strong>{depVar ? displayName(depVar) : "—"}</strong>
        </div>
        <div className="eco-summary-row">
          <span>X vars:</span><strong>{indepVars.length > 0 ? indepVars.map(displayName).join(", ") : "—"}</strong>
        </div>
        <div className="eco-summary-row">
          <span>Confianza:</span><strong>{(confidence * 100).toFixed(0)}%</strong>
        </div>
        <button className="eco-btn eco-btn-run" onClick={onRun} disabled={loading || !depVar || indepVars.length === 0}>
          {loading ? <><Loader size={16} className="eco-spin" /> Procesando…</> : <><Play size={16} /> Ejecutar Regresión</>}
        </button>
      </div>
    </div>
  );
}
