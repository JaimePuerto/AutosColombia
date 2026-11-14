import { useCallback, useEffect, useState } from "react";
import "./Auditoria.css";

const API_URL = "http://localhost:3001/api";

// RF-38: consulta unificada de auditoría (operaciones y autenticación) con todos
// los filtros: usuario, fechas, tipo de evento, acción y entidad.
export default function Auditoria() {
  const [eventos, setEventos] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ usuario: "", desde: "", hasta: "", tipo: "", accion: "", entidad: "" });

  const token = () => sessionStorage.getItem("autoscolombia_token") || "";

  const cargar = useCallback(async (e) => {
    if (e) e.preventDefault();
    setCargando(true); setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
      params.set("limite", "300");
      const r = await fetch(`${API_URL}/auditoria?${params.toString()}`, { headers: { Authorization: `Bearer ${token()}` } });
      const json = await r.json();
      if (!r.ok || !json.ok) throw new Error(json.mensaje || "No fue posible consultar la auditoría.");
      setEventos(Array.isArray(json.data) ? json.data : []);
    } catch (err) { setError(err.message || "Error consultando auditoría."); }
    finally { setCargando(false); }
  }, [filtros]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/operadores`, { headers: { Authorization: `Bearer ${token()}` } });
        const json = await r.json();
        if (activo && r.ok && json.ok) setOperadores(json.data || []);
      } catch { /* el filtro de usuario queda vacío */ }
    })();
    return () => { activo = false; };
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiar(k, v) { setFiltros((actual) => ({ ...actual, [k]: v })); }
  function mostrar(v) { if (v == null || v === "") return "—"; if (typeof v === "object") return JSON.stringify(v); return String(v); }
  function mostrarFecha(v) { return v ? new Date(v).toLocaleString("es-CO") : "—"; }

  return (
    <section className="audit-page">
      <div className="audit-heading">
        <div>
          <p className="audit-eyebrow">CONTROL Y TRAZABILIDAD</p>
          <h2>Auditoría del sistema</h2>
          <p>Consulta unificada de operaciones (usuarios, clientes, vehículos, celdas, movimientos) y eventos de autenticación.</p>
        </div>
        <button type="button" onClick={() => cargar()} className="audit-refresh">Actualizar</button>
      </div>

      <form className="audit-filters" onSubmit={cargar}>
        <label>Usuario
          <select value={filtros.usuario} onChange={(e) => cambiar("usuario", e.target.value)}>
            <option value="">Todos</option>
            {operadores.map((o) => <option key={o.id} value={o.id}>{o.nombre}{o.documento ? ` · ${o.documento}` : ""}</option>)}
          </select>
        </label>
        <label>Desde<input type="date" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} /></label>
        <label>Hasta<input type="date" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} /></label>
        <label>Tipo
          <select value={filtros.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
            <option value="">Todos</option>
            <option value="OPERACION">Operación</option>
            <option value="AUTENTICACION">Autenticación</option>
          </select>
        </label>
        <label>Acción<input value={filtros.accion} onChange={(e) => cambiar("accion", e.target.value)} placeholder="Ej. ENTRADA" /></label>
        <label>Entidad<input value={filtros.entidad} onChange={(e) => cambiar("entidad", e.target.value)} placeholder="Ej. MOVIMIENTO" /></label>
        <button type="submit" disabled={cargando}>{cargando ? "Consultando..." : "Aplicar filtros"}</button>
      </form>

      {error && <div className="audit-error" role="alert">{error}</div>}

      <div className="audit-table-wrap">
        <table>
          <thead>
            <tr><th>FECHA</th><th>TIPO</th><th>USUARIO</th><th>ACCIÓN</th><th>ENTIDAD</th><th>ID</th><th>MOTIVO</th><th>DETALLE</th></tr>
          </thead>
          <tbody>
            {eventos.map((item, i) => (
              <tr key={item.id || i}>
                <td>{mostrarFecha(item.fecha_hora || item.creado_en)}</td>
                <td>{item.tipo_evento === "AUTENTICACION" ? "Autenticación" : "Operación"}</td>
                <td>{mostrar(item.operador || item.operador_nombre || item.usuario || item.operador_id)}</td>
                <td>{mostrar(item.accion)}</td>
                <td>{mostrar(item.entidad)}</td>
                <td>{mostrar(item.entidad_id)}</td>
                <td>{mostrar(item.motivo)}</td>
                <td>
                  <details>
                    <summary>Ver cambios</summary>
                    <div><b>Antes:</b> {mostrar(item.valores_anteriores || item.datos_anteriores)}</div>
                    <div><b>Después:</b> {mostrar(item.valores_nuevos || item.datos_nuevos)}</div>
                  </details>
                </td>
              </tr>
            ))}
            {eventos.length === 0 && <tr><td colSpan="8" className="audit-empty">{cargando ? "Cargando eventos..." : "No hay eventos para los filtros seleccionados."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
