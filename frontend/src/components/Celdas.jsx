import { useCallback, useEffect, useState } from "react";
import "./Celdas.css";
import Modal from "./Modal.jsx";

const API_URL = "http://localhost:3001/api";

function Celdas({ token }) {
  const [celdas, setCeldas] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [filtros, setFiltros] = useState({ buscar: "", tipo: "TODOS", estado: "TODOS" });
  const [formulario, setFormulario] = useState({ codigo: "", tipo: "CARRO", ubicacion: "" });
  const [editando, setEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [operacion, setOperacion] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [historial, setHistorial] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");

  const headers = useCallback((json = false) => ({
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  }), [token]);

  const mostrarMensaje = (texto, tipo = "success") => {
    setMensaje(texto);
    setTipoMensaje(tipo);
  };

  const manejarRespuesta = async (respuesta) => {
    if (respuesta.status === 401) {
      sessionStorage.removeItem("autoscolombia_token");
      window.location.reload();
      throw new Error("La sesión expiró. Inicia sesión nuevamente.");
    }
    const resultado = await respuesta.json();
    if (!respuesta.ok || !resultado.ok) {
      throw new Error(resultado.mensaje || resultado.message || "No fue posible completar la operación.");
    }
    return resultado;
  };

  const consultarCeldas = useCallback(async () => {
    setCargando(true);
    try {
      const parametros = new URLSearchParams();
      if (filtros.buscar.trim()) parametros.set("buscar", filtros.buscar.trim());
      if (filtros.tipo !== "TODOS") parametros.set("tipo", filtros.tipo);
      if (filtros.estado !== "TODOS") parametros.set("estado", filtros.estado);
      const [rCeldas, rResumen] = await Promise.all([
        fetch(`${API_URL}/celdas?${parametros.toString()}`, { headers: headers() }),
        fetch(`${API_URL}/celdas/resumen`, { headers: headers() }),
      ]);
      const [jCeldas, jResumen] = await Promise.all([
        manejarRespuesta(rCeldas),
        manejarRespuesta(rResumen),
      ]);
      setCeldas(jCeldas.data || []);
      setResumen(jResumen.data || []);
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setCargando(false);
    }
  }, [filtros, headers]);

  useEffect(() => { consultarCeldas(); }, [consultarCeldas]);

  const limpiarFormulario = () => {
    setFormulario({ codigo: "", tipo: "CARRO", ubicacion: "" });
    setEditando(null);
    setMostrarFormulario(false);
  };

  const nuevaCelda = () => {
    setFormulario({ codigo: "", tipo: "CARRO", ubicacion: "" });
    setEditando(null);
    setMensaje("");
    setMostrarFormulario(true);
  };

  const editarCelda = (celda) => {
    setFormulario({ codigo: celda.codigo || "", tipo: celda.tipo || "CARRO", ubicacion: celda.ubicacion || "" });
    setEditando(celda);
    setMensaje("");
    setMostrarFormulario(true);
  };

  const guardarCelda = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setMensaje("");
    try {
      const editandoAhora = Boolean(editando);
      const respuesta = await fetch(
        editandoAhora ? `${API_URL}/celdas/${editando.id}` : `${API_URL}/celdas`,
        {
          method: editandoAhora ? "PUT" : "POST",
          headers: headers(true),
          body: JSON.stringify(formulario),
        }
      );
      await manejarRespuesta(respuesta);
      limpiarFormulario();
      mostrarMensaje(editandoAhora ? "Celda actualizada correctamente." : "Celda creada correctamente.");
      await consultarCeldas();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarCambioEstado = async (event) => {
    event.preventDefault();
    if (!operacion || !motivo.trim()) {
      mostrarMensaje("Debes indicar el motivo de la operación.", "error");
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await fetch(`${API_URL}/celdas/${operacion.id}/${operacion.accion}`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      await manejarRespuesta(respuesta);
      setOperacion(null);
      setMotivo("");
      mostrarMensaje(operacion.accion === "bloquear" ? "Celda bloqueada correctamente." : "Celda desbloqueada correctamente.");
      await consultarCeldas();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const consultarHistorial = async (celda) => {
    try {
      const respuesta = await fetch(`${API_URL}/celdas/${celda.id}/historial`, { headers: headers() });
      const resultado = await manejarRespuesta(respuesta);
      setHistorial({ celda, eventos: resultado.data || [] });
    } catch (error) {
      mostrarMensaje(error.message, "error");
    }
  };

  const total = (tipo, campo) => {
    const fila = resumen.find((item) => item.tipo === tipo);
    return Number(fila?.[campo] || 0);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h2>Gestión de celdas</h2>
          <p className="page-description">Administra espacios, disponibilidad, bloqueos e historial de las celdas.</p>
        </div>
        <button className="primary-button" type="button" onClick={nuevaCelda}>+ Nueva celda</button>
      </div>

      {mensaje && <div className={`form-message ${tipoMensaje}`} role="alert">{mensaje}</div>}

      <section className="celda-summary">
        {["CARRO", "MOTO"].map((tipo) => (
          <article className="panel celda-summary-card" key={tipo}>
            <span>{tipo === "CARRO" ? "Celdas para carros" : "Celdas para motos"}</span>
            <strong>{total(tipo, "total")}</strong>
            <div className="celda-summary-detail">
              <span>Disponibles: <b>{total(tipo, "disponibles")}</b></span>
              <span>Ocupadas: <b>{total(tipo, "ocupadas")}</b></span>
              <span>Bloqueadas: <b>{total(tipo, "bloqueadas")}</b></span>
            </div>
          </article>
        ))}
      </section>

      {mostrarFormulario && (
        <Modal label={editando ? "Editar celda" : "Registrar celda"} onClose={limpiarFormulario} message={tipoMensaje === "error" ? mensaje : ""}>
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>{editando ? "Modificar celda" : "Registrar celda"}</h3>
              <p>Completa los datos de identificación y ubicación.</p>
            </div>
          </div>
          <form onSubmit={guardarCelda}>
            <div className="form-grid">
              <label className="field">
                <span>Código *</span>
                <input name="codigo" value={formulario.codigo} onChange={(e) => setFormulario((v) => ({ ...v, codigo: e.target.value.toUpperCase() }))} maxLength={20} required />
              </label>
              <label className="field">
                <span>Tipo *</span>
                <select name="tipo" value={formulario.tipo} onChange={(e) => setFormulario((v) => ({ ...v, tipo: e.target.value }))} required>
                  <option value="CARRO">Carro</option>
                  <option value="MOTO">Moto</option>
                </select>
              </label>
              <label className="field">
                <span>Ubicación *</span>
                <input name="ubicacion" value={formulario.ubicacion} onChange={(e) => setFormulario((v) => ({ ...v, ubicacion: e.target.value }))} maxLength={100} required />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={limpiarFormulario} disabled={guardando}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={guardando}>{guardando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar celda"}</button>
            </div>
          </form>
        </section>
        </Modal>
      )}

      {operacion && (
        <Modal
          label={`${operacion.accion === "bloquear" ? "Bloquear" : "Desbloquear"} celda ${operacion.codigo}`}
          onClose={() => { setOperacion(null); setMotivo(""); }}
          message={tipoMensaje === "error" ? mensaje : ""}
        >
        <section className="panel form-panel celda-reason-panel">
          <div className="form-section-heading">
            <div>
              <h3>{operacion.accion === "bloquear" ? "Bloquear celda" : "Desbloquear celda"} {operacion.codigo}</h3>
              <p>El motivo quedará registrado en el historial y la auditoría.</p>
            </div>
          </div>
          <form onSubmit={ejecutarCambioEstado}>
            <label className="field">
              <span>Motivo *</span>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3} required />
            </label>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => { setOperacion(null); setMotivo(""); }} disabled={guardando}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={guardando || !motivo.trim()}>{guardando ? "Procesando..." : "Confirmar operación"}</button>
            </div>
          </form>
        </section>
        </Modal>
      )}

      {historial && (
        <section className="panel form-panel">
          <div className="celda-history-heading">
            <div><h3>Historial: {historial.celda.codigo}</h3><p>{historial.eventos.length} eventos registrados</p></div>
            <button type="button" className="secondary-button" onClick={() => setHistorial(null)}>Cerrar historial</button>
          </div>
          {historial.eventos.length === 0 ? <p className="empty-state">Esta celda todavía no tiene eventos.</p> : (
            <div className="table-wrapper">
              <table className="movement-table">
                <thead><tr><th>FECHA</th><th>ORIGEN</th><th>OPERADOR</th><th>ACCIÓN</th><th>MOTIVO</th><th>VALOR ANTERIOR</th><th>VALOR NUEVO</th></tr></thead>
                <tbody>{historial.eventos.map((evento) => (
                  <tr key={evento.id}>
                    <td>{evento.fecha_hora ? new Date(evento.fecha_hora).toLocaleString("es-CO") : "—"}</td>
                    <td><span className={`pill ${evento.origen === "MOVIMIENTO" ? "neutral" : "active-pill"}`}>{evento.origen === "MOVIMIENTO" ? "Movimiento" : "Celda"}</span></td>
                    <td>{evento.operador || "No identificado"}</td>
                    <td>{evento.accion}</td>
                    <td>{evento.motivo || "—"}</td>
                    <td><code>{evento.valor_anterior ? JSON.stringify(evento.valor_anterior) : "—"}</code></td>
                    <td><code>{evento.valor_nuevo ? JSON.stringify(evento.valor_nuevo) : "—"}</code></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel recent-panel history-panel">
        <div className="history-toolbar">
          <div><h3>Directorio de celdas</h3><p>{celdas.length} celdas encontradas</p></div>
          <div className="history-filters">
            <input className="search-input" value={filtros.buscar} onChange={(e) => setFiltros((v) => ({ ...v, buscar: e.target.value }))} placeholder="Buscar código o ubicación..." />
            <select className="search-input" value={filtros.tipo} onChange={(e) => setFiltros((v) => ({ ...v, tipo: e.target.value }))}>
              <option value="TODOS">Todos los tipos</option><option value="CARRO">Carros</option><option value="MOTO">Motos</option>
            </select>
            <select className="search-input" value={filtros.estado} onChange={(e) => setFiltros((v) => ({ ...v, estado: e.target.value }))}>
              <option value="TODOS">Todos los estados</option><option value="DISPONIBLE">Disponibles</option><option value="OCUPADA">Ocupadas</option><option value="BLOQUEADA">Bloqueadas</option>
            </select>
          </div>
        </div>
        {cargando ? <p className="empty-state">Consultando celdas...</p> : celdas.length === 0 ? <p className="empty-state">No hay celdas que coincidan con los filtros.</p> : (
          <div className="table-wrapper">
            <table className="movement-table">
              <thead><tr><th>CÓDIGO</th><th>TIPO</th><th>UBICACIÓN</th><th>ESTADO</th><th>VEHÍCULO</th><th>CLIENTE</th><th>OPERADOR DE INGRESO</th><th>ACCIONES</th></tr></thead>
              <tbody>{celdas.map((celda) => (
                <tr key={celda.id}>
                  <td><strong>{celda.codigo}</strong></td>
                  <td>{celda.tipo === "CARRO" ? "Carro" : "Moto"}</td>
                  <td>{celda.ubicacion}</td>
                  <td><span className={`pill ${celda.estado === "DISPONIBLE" ? "active-pill" : "neutral"}`}>{celda.estado}</span></td>
                  <td>{celda.placa || "—"}</td>
                  <td>{celda.cliente || "—"}</td>
                  <td>{celda.operador_entrada || "—"}</td>
                  <td>
                    <div className="client-actions">
                      {celda.estado === "DISPONIBLE" && <button type="button" className="text-button" onClick={() => editarCelda(celda)}>Editar</button>}
                      {celda.estado !== "OCUPADA" && (
                        celda.estado === "BLOQUEADA"
                          ? <button type="button" className="text-button" onClick={() => setOperacion({ id: celda.id, codigo: celda.codigo, accion: "desbloquear" })}>Desbloquear</button>
                          : <button type="button" className="text-button" onClick={() => setOperacion({ id: celda.id, codigo: celda.codigo, accion: "bloquear" })}>Bloquear</button>
                      )}
                      <button type="button" className="text-button" onClick={() => consultarHistorial(celda)}>Historial</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default Celdas;
