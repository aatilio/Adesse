import { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart, ReferenceLine, Area, AreaChart
} from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle2, Hash, Percent } from "lucide-react";

function fmt(v, d = 4) {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toFixed(d);
}

function MetricCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="eco-metric-card" style={{ borderLeftColor: color }}>
      <div className="eco-metric-icon" style={{ color }}><Icon size={20} /></div>
      <div>
        <div className="eco-metric-value">{value}</div>
        <div className="eco-metric-label">{label}</div>
        {sub && <div className="eco-metric-sub">{sub}</div>}
      </div>
    </div>
  );
}

function CoeffTable({ coefficients }) {
  return (
    <div className="eco-card">
      <div className="eco-card-title">Tabla de Coeficientes</div>
      <div className="eco-table-wrap">
        <table className="eco-table eco-coeff-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Coef. (β̂)</th>
              <th>Err. Std.</th>
              <th>t</th>
              <th>P&gt;|t|</th>
              <th>IC Inf.</th>
              <th>IC Sup.</th>
            </tr>
          </thead>
          <tbody>
            {coefficients.map((c, i) => (
              <tr key={i}>
                <td className="eco-coeff-name">
                  {c.name}
                  {c.significance && <sup className="eco-stars">{c.significance}</sup>}
                </td>
                <td className="eco-num">{fmt(c.coef)}</td>
                <td className="eco-num">{fmt(c.std_err)}</td>
                <td className="eco-num">{fmt(c.t_stat)}</td>
                <td className={`eco-num ${c.p_value < 0.05 ? "eco-sig" : ""}`}>{fmt(c.p_value)}</td>
                <td className="eco-num">{fmt(c.ci_lower)}</td>
                <td className="eco-num">{fmt(c.ci_upper)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="eco-table-footnote">
        <sup>***</sup> p&lt;0.01 &nbsp; <sup>**</sup> p&lt;0.05 &nbsp; <sup>*</sup> p&lt;0.10
      </div>
    </div>
  );
}

function ScatterPlot({ scatterData, fittedLine, depVarName, indepVarName }) {
  if (!scatterData || !fittedLine) return null;
  const merged = fittedLine.map((f) => {
    const match = scatterData.find((s) => s.x === f.x);
    return { x: f.x, y: match?.y ?? null, yhat: f.yhat };
  });
  // Add scatter points not in fitted line
  scatterData.forEach((s) => {
    if (!merged.find((m) => m.x === s.x && m.y === s.y)) {
      merged.push({ x: s.x, y: s.y, yhat: null });
    }
  });
  merged.sort((a, b) => a.x - b.x);

  return (
    <div className="eco-card">
      <div className="eco-card-title"><TrendingUp size={18} /> Dispersión y Ajuste Lineal</div>
      <p className="eco-card-desc">{indepVarName} vs {depVarName}</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={merged} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="x" name={indepVarName} tick={{ fontSize: 11 }} label={{ value: indepVarName, position: "bottom", offset: 10, fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} label={{ value: depVarName, angle: -90, position: "insideLeft", offset: 0, fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
          <Scatter dataKey="y" fill="#3b82f6" name="Observado" r={4} fillOpacity={0.7} />
          <Line dataKey="yhat" stroke="#ef4444" strokeWidth={2} dot={false} name="Ŷ (Predicho)" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function GaussianBell({ gaussianCurve, criticalValue, tStat, coeffName }) {
  if (!gaussianCurve) return null;
  const clampedT = Math.max(-4, Math.min(4, tStat));

  // Build fill area data for rejection zones
  const data = gaussianCurve.map((p) => ({
    ...p,
    reject: (p.z <= -criticalValue || p.z >= criticalValue) ? p.density : 0,
    accept: (p.z > -criticalValue && p.z < criticalValue) ? p.density : 0,
  }));

  return (
    <div className="eco-card">
      <div className="eco-card-title">Campana de Gauss — Inferencia</div>
      <p className="eco-card-desc">
        Coeficiente: <strong>{coeffName}</strong> · t = {fmt(tStat, 3)} · Zc = ±{fmt(criticalValue, 3)}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="z" tick={{ fontSize: 10 }} label={{ value: "Z", position: "bottom", offset: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
          <Area type="monotone" dataKey="accept" stroke="none" fill="#dbeafe" fillOpacity={0.6} name="No rechazo" />
          <Area type="monotone" dataKey="reject" stroke="none" fill="#fee2e2" fillOpacity={0.8} name="Rechazo" />
          <Area type="monotone" dataKey="density" stroke="#3b82f6" strokeWidth={2} fill="none" name="N(0,1)" />
          <ReferenceLine x={-criticalValue} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `-${fmt(criticalValue, 2)}`, position: "top", fontSize: 10, fill: "#ef4444" }} />
          <ReferenceLine x={criticalValue} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `+${fmt(criticalValue, 2)}`, position: "top", fontSize: 10, fill: "#ef4444" }} />
          <ReferenceLine x={clampedT} stroke="#7c3aed" strokeWidth={2.5} label={{ value: `t=${fmt(tStat, 2)}`, position: "insideTopRight", fontSize: 11, fill: "#7c3aed", fontWeight: 700 }} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="eco-bell-legend">
        <span className="eco-legend-item"><span className="eco-dot" style={{ background: "#dbeafe" }} /> No rechazo H₀</span>
        <span className="eco-legend-item"><span className="eco-dot" style={{ background: "#fca5a5" }} /> Rechazo H₀</span>
        <span className="eco-legend-item"><span className="eco-dot" style={{ background: "#7c3aed" }} /> Estadístico t</span>
      </div>
    </div>
  );
}

export default function ResultsPanel({ results, depVarName, indepVarNames, confidence }) {
  // Find main regressor (first non-intercept coefficient)
  const mainCoeff = useMemo(() => {
    return results.coefficients.find((c) => c.name !== "Intercepto (β₀)") || results.coefficients[0];
  }, [results]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Metric cards */}
      <div className="eco-metrics-grid">
        <MetricCard icon={Hash} label="Observaciones (n)" value={results.n} color="#3b82f6" />
        <MetricCard icon={Percent} label="R²" value={fmt(results.r_squared)} color="#10b981" sub={`Ajust: ${fmt(results.r_squared_adj)}`} />
        <MetricCard
          icon={results.is_heteroscedastic ? AlertTriangle : CheckCircle2}
          label="Errores Estándar"
          value={results.se_type}
          color={results.is_heteroscedastic ? "#f59e0b" : "#10b981"}
          sub={`BP p-val: ${fmt(results.hetero_test_pvalue)}`}
        />
      </div>

      <CoeffTable coefficients={results.coefficients} />

      <div className="eco-charts-grid">
        <ScatterPlot
          scatterData={results.scatter_data}
          fittedLine={results.fitted_line}
          depVarName={depVarName}
          indepVarName={indepVarNames[0] || "X"}
        />
        <GaussianBell
          gaussianCurve={results.gaussian_curve}
          criticalValue={results.critical_value}
          tStat={mainCoeff?.t_stat ?? 0}
          coeffName={mainCoeff?.name ?? "—"}
        />
      </div>
    </div>
  );
}
