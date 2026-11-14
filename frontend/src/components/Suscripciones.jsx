import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "./Modal.jsx";

const API_URL = "http://localhost:3001/api";

function fechaLocalISO(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function sumarDiasISO(fecha, dias) {
  const [y, m, d] = fecha.split("-").map(Number);
  const valor = new Date(y, m - 1, d);
  valor.setDate(valor.getDate() + dias);
  return fechaLocalISO(valor);
}
function formatoFecha(fecha) {
  if (!fecha) return "—";
  const valor = String(fecha).slice(0, 10);
  const [y, m, d] = valor.split("-");
  return `${d}/${m}/${y}`;
}
function moneda(valor) {
  return Number(valor || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default function Suscripciones({ token }) {
  const [suscripciones, setSuscripciones] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [historialVehiculo, setHistorialVehiculo] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [estado, setEstado] = useState("TODOS");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [vehiculoId, setVehiculoId] = useState("");
  const [valor, setValor] = useState("");
  const [fechaInicio, setFechaInicio] = useState(fechaLocalISO());
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // RF-29: modificación de la fecha de activación de una mensualidad.
  const [modificando, setModificando] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [motivoFecha, setMotivoFecha] = useState("");
  const [cancelando, setCancelando] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  const headers = useCallback((json = false) => ({
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  }), [token]);

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) } });
    const result = await response.json();
    if (response.status === 401) {
      sessionStorage.removeItem("autoscolombia_token");
      window.location.reload();
      throw new Error("La sesión expiró. Inicia sesión nuevamente.");
    }
    if (!response.ok || !result.ok) throw new Error(result.mensaje || "No fue posible completar la operación.");
    return result;
  }, [headers]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (buscar.trim()) params.set("buscar", buscar.trim());
      if (estado !== "TODOS") params.set("estado", estado);
      const [s, v] = await Promise.all([
        request(`${API_URL}/suscripciones?${params.toString()}`),
        request(`${API_URL}/vehiculos?activo=true`),
      ]);
      setSuscripciones(s.data || []);
      setVehiculos(v.data || []);
      setMensaje("");
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  }, [buscar, estado, request]);

  useEffect(() => { cargar(); }, [cargar]);

  const vehiculoSeleccionado = vehiculos.find(v => String(v.id) === String(vehiculoId));
  const fechaFin = fechaInicio ? sumarDiasISO(fechaInicio, 29) : "";
  useEffect(() => {
    let vigente = true;
    async function cargarHistorialVehiculo() {
      if (!vehiculoId) { setHistorialVehiculo([]); setFechaInicio(fechaLocalISO()); return; }
      try {
        const resultado = await request(`${API_URL}/suscripciones?vehiculo_id=${encodeURIComponent(vehiculoId)}`);
        if (vigente) setHistorialVehiculo(resultado.data || []);
      } catch (error) {
        if (vigente) {
          setHistorialVehiculo([]);
          setMensaje(error.message);
          setTipoMensaje("error");
        }
      }
    }
    cargarHistorialVehiculo();
    return () => { vigente = false; };
  }, [vehiculoId, request]);

  const ultimaSuscripcion = useMemo(() => historialVehiculo
    .filter(s => s.estado !== "CANCELADA")
    .sort((a,b) => String(b.fecha_fin).slice(0,10).localeCompare(String(a.fecha_fin).slice(0,10)))[0] || null,
  [historialVehiculo]);

  function abrirFormulario() {
    setVehiculoId("");
    setValor("");
    setFechaInicio(fechaLocalISO());
    setMostrarFormulario(true);
    setMensaje("");
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setVehiculoId("");
    setValor("");
    setFechaInicio(fechaLocalISO());
  }

  useEffect(() => {
    if (!vehiculoId) return;
    if (ultimaSuscripcion) setFechaInicio(sumarDiasISO(String(ultimaSuscripcion.fecha_fin).slice(0,10), 1));
    else setFechaInicio(fechaLocalISO());
  }, [vehiculoId, ultimaSuscripcion]);

  async function crear(event) {
    event.preventDefault();
    setGuardando(true);
    setMensaje("");
    try {
      if (!vehiculoId) throw new Error("Selecciona un vehículo.");
      if (Number(valor) <= 0) throw new Error("Ingresa un valor mayor que cero.");
      await request(`${API_URL}/suscripciones`, {
        method: "POST",
        body: JSON.stringify({
          vehiculo_id: Number(vehiculoId),
          valor: Number(valor),
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        }),
      });
      cerrarFormulario();
      await cargar();
      setMensaje("Suscripción registrada. El estado se actualizará automáticamente según su fecha de inicio.");
      setTipoMensaje("success");
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  }

  function cancelar(item) {
    setCancelando(item);
    setMotivoCancelacion("");
    setMensaje("");
  }

  async function confirmarCancelacion(event) {
    event.preventDefault();
    if (!motivoCancelacion.trim()) {
      setMensaje("Debes indicar un motivo de cancelación.");
      setTipoMensaje("error");
      return;
    }
    setGuardando(true);
    try {
      await request(`${API_URL}/suscripciones/${cancelando.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "CANCELADA", motivo: motivoCancelacion.trim() }),
      });
      setCancelando(null);
      setMotivoCancelacion("");
      await cargar();
      setMensaje("Suscripción cancelada. El período queda disponible para una nueva asignación y el registro histórico se conserva.");
      setTipoMensaje("success");
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  }

  // RF-29: abre el formulario para cambiar la fecha de activación.
  function abrirModificacion(item) {
    setModificando(item);
    setNuevaFecha(String(item.fecha_inicio).slice(0, 10));
    setMotivoFecha("");
    setMensaje("");
  }

  async function confirmarModificacion(event) {
    event.preventDefault();
    if (motivoFecha.trim().length < 5) {
      setMensaje("El motivo debe tener al menos 5 caracteres.");
      setTipoMensaje("error");
      return;
    }
    setGuardando(true);
    try {
      await request(`${API_URL}/suscripciones/${modificando.id}/fecha-activacion`, {
        method: "PATCH",
        body: JSON.stringify({ fecha_inicio: nuevaFecha, motivo: motivoFecha.trim() }),
      });
      setModificando(null);
      await cargar();
      setMensaje("Fecha de activación actualizada correctamente.");
      setTipoMensaje("success");
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  }

  return <>
    <div className="page-heading">
      <div>
        <p className="eyebrow">ADMINISTRACIÓN</p>
        <h2>Gestión de suscripciones</h2>
        <p className="page-description">Administra períodos de 30 días, renovaciones y estados de vigencia por vehículo.</p>
      </div>
      <div className="heading-actions">
        <button className="secondary-button" type="button" onClick={cargar} disabled={cargando}>Actualizar</button>
        <button className="primary-button" type="button" onClick={abrirFormulario}>+ Nueva suscripción</button>
      </div>
    </div>

    {mensaje && <div className={`form-message ${tipoMensaje}`} role="alert">{mensaje}</div>}

    {mostrarFormulario && <Modal label="Registrar suscripción" onClose={cerrarFormulario} message={tipoMensaje === "error" ? mensaje : ""}>
    <section className="panel form-panel">
      <div className="form-section-heading">
        <div>
          <h3>Registrar suscripción</h3>
          <p>Solo se pueden asociar vehículos previamente registrados y activos. No se procesan pagos.</p>
        </div>
      </div>
      <form onSubmit={crear}>
        <div className="form-grid">
          <label className="field">
            <span>Vehículo *</span>
            <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} required>
              <option value="">Selecciona un vehículo</option>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.tipo} · {v.cliente || "Sin cliente"}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Valor de la suscripción (COP) *</span>
            <input type="number" min="1" step="1" value={valor} onChange={e => setValor(e.target.value)} required placeholder="Ej. 150000" />
          </label>
          <label className="field">
            <span>Fecha de inicio *</span>
            <input type="date" value={fechaInicio} min={fechaLocalISO()} onChange={e => setFechaInicio(e.target.value)} required />
            <small>{ultimaSuscripcion ? "Renovación: comienza el día siguiente al último período no cancelado." : "La primera suscripción inicia hoy o en una fecha futura."}</small>
          </label>
          <label className="field">
            <span>Fecha de finalización</span>
            <input type="date" value={fechaFin} readOnly />
            <small>Duración: 30 días calendario, incluyendo el día inicial.</small>
          </label>
        </div>
        {vehiculoSeleccionado && <p className="subscription-note">Vehículo seleccionado: <strong>{vehiculoSeleccionado.placa}</strong>. La suscripción queda en estado <strong>Programada</strong> hasta que comience el período.</p>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={cerrarFormulario} disabled={guardando}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={guardando || cargando || !vehiculos.length}>{guardando ? "Guardando..." : "Registrar suscripción"}</button>
        </div>
      </form>
    </section>
    </Modal>}

    {modificando && (
      <Modal label={`Modificar fecha de activación de la suscripción ${modificando.id}`} onClose={() => setModificando(null)} message={tipoMensaje === "error" ? mensaje : ""}>
      <section className="panel form-panel">
        <div className="form-section-heading">
          <div>
            <h3>Modificar fecha de activación #{modificando.id}</h3>
            <p>Vehículo {modificando.placa}. El período se recalcula a 30 días y no puede cruzarse con otro período del mismo vehículo.</p>
          </div>
        </div>
        <form onSubmit={confirmarModificacion}>
          <div className="form-grid">
            <label className="field">
              <span>Nueva fecha de inicio *</span>
              <input type="date" value={nuevaFecha} min={fechaLocalISO()} onChange={e => setNuevaFecha(e.target.value)} required />
              <small>Nueva fecha de finalización: {nuevaFecha ? formatoFecha(sumarDiasISO(nuevaFecha, 29)) : "—"}.</small>
            </label>
            <label className="field">
              <span>Motivo *</span>
              <input value={motivoFecha} onChange={e => setMotivoFecha(e.target.value)} maxLength={500} required />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setModificando(null)} disabled={guardando}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={guardando || motivoFecha.trim().length < 5}>
              {guardando ? "Guardando..." : "Guardar fecha"}
            </button>
          </div>
        </form>
      </section>
      </Modal>
    )}

    {cancelando && (
      <Modal label={`Cancelar suscripción ${cancelando.id}`} onClose={() => setCancelando(null)} message={tipoMensaje === "error" ? mensaje : ""}>
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>Cancelar suscripción #{cancelando.id}</h3>
              <p>Indica el motivo. La suscripción quedará cancelada y su historial se conservará.</p>
            </div>
          </div>
          <form onSubmit={confirmarCancelacion}>
            <label className="field">
              <span>Motivo de cancelación *</span>
              <textarea value={motivoCancelacion} onChange={e => setMotivoCancelacion(e.target.value)} maxLength={500} rows={3} required />
            </label>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setCancelando(null)} disabled={guardando}>Volver</button>
              <button type="submit" className="primary-button" disabled={guardando || !motivoCancelacion.trim()}>{guardando ? "Cancelando..." : "Confirmar cancelación"}</button>
            </div>
          </form>
        </section>
      </Modal>
    )}

    <section className="panel recent-panel history-panel">
      <div className="history-toolbar">
        <div><h3>Historial de suscripciones</h3><p>{suscripciones.length} registros consultados</p></div>
        <div className="history-filters">
          <input className="search-input" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar placa, marca o cliente..." />
          <select className="search-input" value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="TODOS">Todos los estados</option>
            <option value="PROGRAMADA">Programadas</option>
            <option value="VIGENTE">Vigentes</option>
            <option value="VENCIDA">Vencidas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>
      </div>
      {cargando ? <p className="empty-state">Consultando suscripciones...</p> : suscripciones.length === 0 ? <p className="empty-state">No hay suscripciones para los filtros seleccionados.</p> : (
        <div className="table-wrapper">
          <table className="movement-table">
            <thead><tr><th>PLACA</th><th>CLIENTE</th><th>PERÍODO</th><th>VALOR</th><th>ESTADO</th><th>ACCIONES</th></tr></thead>
            <tbody>{suscripciones.map(item => (
              <tr key={item.id}>
                <td><strong className="plate-value">{item.placa}</strong><small className="subscription-subtext">{item.tipo} · {item.marca || ""} {item.modelo || ""}</small></td>
                <td>{item.cliente || "—"}</td>
                <td>{formatoFecha(item.fecha_inicio)} – {formatoFecha(item.fecha_fin)}</td>
                <td>{moneda(item.valor)}</td>
                <td><span className={`pill ${item.estado === "VIGENTE" ? "active-pill" : "neutral"}`}>{item.estado}</span></td>
                <td>
                  <div className="client-actions">
                    {item.estado !== "CANCELADA" && <button type="button" className="text-button" disabled={guardando} onClick={() => cancelar(item)}>Cancelar</button>}
                    {(item.estado === "PROGRAMADA" || item.estado === "VIGENTE") && <button type="button" className="text-button" disabled={guardando} onClick={() => abrirModificacion(item)}>Fecha</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  </>;
}
