import { useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet, PenLine, Trash2, Plus } from "lucide-react";

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const rows = lines.slice(1).map((l) => l.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, "")));
  return { headers, rows };
}

export default function DataManager({ headers, aliases, rows, onDataLoaded, onAliasChange, onRowsChange, onHeadersChange }) {
  const fileRef = useRef(null);
  const [csvText, setCsvText] = useState("");
  const [showRename, setShowRename] = useState(false);
  const [editingData, setEditingData] = useState(false);
  const [manualRows, setManualRows] = useState(10);
  const [manualCols, setManualCols] = useState(3);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      const { headers: h, rows: r } = parseCsv(text);
      if (h.length > 0) onDataLoaded(h, r);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePaste = () => {
    const { headers: h, rows: r } = parseCsv(csvText);
    if (h.length > 0) onDataLoaded(h, r);
  };

  const downloadCsv = () => {
    const displayHeaders = headers.map((h) => aliases[h] || h);
    const bom = "\uFEFF";
    const content = bom + [displayHeaders.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "datos_regresion.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    onRowsChange(next);
  };

  const updateCell = (ri, ci, val) => {
    const next = rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? val : c)) : r));
    onRowsChange(next);
  };

  const addRow = () => {
    onRowsChange([...rows, headers.map(() => "")]);
  };

  const addColumn = () => {
    const newHeader = `Var${headers.length + 1}`;
    onHeadersChange([...headers, newHeader]);
    onRowsChange(rows.map((r) => [...r, ""]));
  };

  const deleteColumn = (ci) => {
    onHeadersChange(headers.filter((_, i) => i !== ci));
    onRowsChange(rows.map((r) => r.filter((_, i) => i !== ci)));
  };

  const handleGenerateTable = () => {
    const h = Array.from({ length: manualCols }, (_, i) => `Var${i + 1}`);
    const r = Array.from({ length: manualRows }, () => Array(manualCols).fill(""));
    onDataLoaded(h, r, true);
    setEditingData(true);
  };

  const hasData = headers.length > 0 && rows.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Upload area */}
      <div className="eco-card">
        <div className="eco-card-title"><Upload size={18} /> Cargar Datos</div>
        <div className="eco-upload-zone" onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet size={36} strokeWidth={1.5} style={{ color: "var(--primary)", opacity: 0.7 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>Arrastra un archivo CSV o haz clic aquí</p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--gray-400)" }}>Formato .csv separado por comas, punto y coma, o tabulaciones</p>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFile} hidden />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label className="eco-label">O pega datos CSV manualmente:</label>
          <textarea
            className="eco-textarea"
            rows={5}
            placeholder={"Var1,Var2,Var3\n10,20,30\n15,25,35\n..."}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <button className="eco-btn eco-btn-primary" onClick={handlePaste} disabled={!csvText.trim()} style={{ marginTop: "0.5rem" }}>
            Procesar Texto
          </button>
        </div>

        <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--gray-200)", paddingTop: "1.5rem" }}>
          <div className="eco-card-title"><PenLine size={18} /> Crear Tabla Manualmente</div>
          <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "var(--gray-500)" }}>
            Genera una tabla vacía para ingresar los datos celda por celda.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label className="eco-label">Variables (Columnas)</label>
              <input type="number" min="1" max="20" className="eco-cell-input" style={{ width: "100px", background: "white" }} value={manualCols} onChange={(e) => setManualCols(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div>
              <label className="eco-label">Observaciones (Filas)</label>
              <input type="number" min="2" max="1000" className="eco-cell-input" style={{ width: "100px", background: "white" }} value={manualRows} onChange={(e) => setManualRows(Math.max(2, parseInt(e.target.value) || 2))} />
            </div>
            <button className="eco-btn eco-btn-primary" onClick={handleGenerateTable}>
              Generar Tabla
            </button>
          </div>
        </div>
      </div>

      {/* Data preview */}
      {hasData && (
        <div className="eco-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className="eco-card-title"><FileSpreadsheet size={18} /> Vista Previa</div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span className="eco-badge">{rows.length} obs.</span>
              <span className="eco-badge">{headers.length} vars.</span>
              <button className="eco-btn-icon" onClick={() => setShowRename(!showRename)} title="Renombrar variables"><PenLine size={14} /></button>
              <button className="eco-btn-icon" onClick={() => setEditingData(!editingData)} title="Editar datos">{editingData ? "✓" : "✎"}</button>
              <button className="eco-btn-icon" onClick={downloadCsv} title="Descargar CSV"><Download size={14} /></button>
            </div>
          </div>

          {showRename && (
            <div className="eco-rename-grid">
              {headers.map((h, i) => (
                <div key={i} className="eco-rename-item">
                  <span className="eco-rename-original">{h}</span>
                  <input
                    className="eco-rename-input"
                    value={aliases[h] || h}
                    onChange={(e) => onAliasChange(h, e.target.value)}
                    placeholder={h}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="eco-table-wrap">
            <table className="eco-table">
              <thead>
                <tr>
                  {editingData && <th style={{ width: 36 }}></th>}
                  <th className="eco-th-idx">#</th>
                  {headers.map((h, i) => (
                    <th key={i}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        <span>{aliases[h] || h}</span>
                        {editingData && headers.length > 1 && (
                          <button className="eco-btn-del" style={{ padding: "2px" }} onClick={() => deleteColumn(i)} title="Eliminar variable"><Trash2 size={10} /></button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, ri) => (
                  <tr key={ri}>
                    {editingData && (
                      <td>
                        <button className="eco-btn-del" onClick={() => deleteRow(ri)} title="Eliminar fila"><Trash2 size={12} /></button>
                      </td>
                    )}
                    <td className="eco-td-idx">{ri + 1}</td>
                    {r.map((c, ci) => (
                      <td key={ci}>
                        {editingData ? (
                          <input className="eco-cell-input" value={c} onChange={(e) => updateCell(ri, ci, e.target.value)} />
                        ) : (
                          <span className={isNaN(Number(c)) || c === "" ? "eco-cell-nan" : ""}>{c || "—"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editingData && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button className="eco-btn eco-btn-ghost" onClick={addRow}>
                <Plus size={14} /> Agregar Fila
              </button>
              <button className="eco-btn eco-btn-ghost" onClick={addColumn}>
                <Plus size={14} /> Agregar Variable
              </button>
            </div>
          )}
          {rows.length > 100 && <p style={{ textAlign: "center", color: "var(--gray-400)", fontSize: "0.75rem", marginTop: "0.5rem" }}>Mostrando primeras 100 de {rows.length} filas</p>}
        </div>
      )}
    </div>
  );
}
