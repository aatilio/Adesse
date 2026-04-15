import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function AttendanceCrud() {
  const [asistencias, setAsistencias] = useState([]);
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('Presente');

  const fetchAsistencias = async () => {
    try {
      const res = await fetch(`${API_URL}/api/asistencias`);
      const data = await res.json();
      setAsistencias(data);
    } catch (err) {
      console.error('Error fetching:', err);
    }
  };

  useEffect(() => {
    fetchAsistencias();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre) return;

    try {
      await fetch(`${API_URL}/api/asistencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, estado }),
      });
      setNombre('');
      fetchAsistencias();
    } catch (err) {
      console.error('Error creating:', err);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left', padding: '2rem' }}>
      <h2>Registro de Asistencia</h2>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={nombre} 
          onChange={(e) => setNombre(e.target.value)} 
          placeholder="Nombre del empleado"
          style={{ flex: 1, padding: '8px' }}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ padding: '8px' }}>
          <option value="Presente">Presente</option>
          <option value="Ausente">Ausente</option>
          <option value="Tarde">Tarde</option>
        </select>
        <button type="submit" style={{ padding: '8px 16px' }}>Registrar</button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {asistencias.map((item) => (
          <li key={item.id} style={{ 
            background: '#f9f9f9', color: '#333',
            margin: '5px 0', padding: '10px', 
            borderRadius: '4px',
            display: 'flex', justifyContent: 'space-between'
          }}>
            <span><strong>{item.nombre}</strong></span>
            <span style={{
              fontWeight: 'bold', 
              color: item.estado === 'Presente' ? 'green' : item.estado === 'Ausente' ? 'red' : 'orange'
            }}>
              {item.estado}
            </span>
          </li>
        ))}
      </ul>
      {asistencias.length === 0 && <p>No hay registros todavía.</p>}
    </div>
  );
}
