
import { useCallback, useEffect, useMemo, useState } from "react";
import "./Pagos.css";

const API_URL = "http://localhost:3001/api";

const moneda = (valor) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2
  }).format(Number(valor || 0));

const fecha = (valor) => valor ? String(valor).slice(0, 10) : "—";

function imprimirComprobante(pago) {
  const seguro = (valor) =>
    String(valor ?? "—").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const ventana = window.open("", "_blank", "width=800,height=700");

  if (!ventana) {
    alert("Permite las ventanas emergentes para visualizar el comprobante.");
    return;
  }

  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${seguro(pago.numero_comprobante)}</title><style>body{font-family:Arial,sans-serif;color:#1e293b;margin:40px auto;max-width:680px;padding:24px}h1{font-size:22px;margin-bottom:4px}.muted{color:#64748b}.line{border-top:1px solid #cbd5e1;margin:22px 0}.row{display:flex;justify-content:space-between;gap:20px;padding:9px 0;border-bottom:1px solid #e2e8f0}.total{font-size:20px;font-weight:bold}.foot{margin-top:30px;font-size:12px;color:#64748b}@media print{button{display:none}}</style></head><body><h1>AUTOS COLOMBIA</h1><div class="muted">Comprobante de pago de mensualidad</div><div class="line"></div><div class="row"><b>Comprobante</b><span>${seguro(pago.numero_comprobante)}</span></div><div class="row"><b>Fecha de pago</b><span>${seguro(pago.fecha_pago)}</span></div><div class="row"><b>Cliente</b><span>${seguro(pago.cliente)}</span></div><div class="row"><b>Documento</b><span>${seguro(pago.tipo_documento)} ${seguro(pago.numero_documento)}</span></div><div class="row"><b>Vehículo</b><span>${seguro(pago.placa)} · ${seguro(pago.tipo)} ${seguro(pago.marca)}</span></div><div class="row"><b>Concepto</b><span>Mensualidad ${seguro(fecha(pago.fecha_inicio))} a ${seguro(fecha(pago.fecha_fin))}</span></div><div class="row"><b>Método</b><span>${seguro(pago.metodo_pago)}</span></div><div class="row"><b>Referencia</b><span>${seguro(pago.referencia)}</span></div><div class="row total"><b>Valor pagado</b><span>${seguro(moneda(pago.valor))}</span></div><div class="row"><b>Responsable</b><span>${seguro(pago.responsable)}</span></div><div class="row"><b>Estado</b><span>${seguro(pago.estado)}</span></div><p class="foot">Este comprobante acredita el registro del pago en el sistema Autos Colombia.</p><button onclick="window.print()">Imprimir / Guardar como PDF</button></body></html>`);

  ventana.document.close();
}

const formularioInicial = {
  tipo_vehiculo_id: "",
  valor: "",
  fecha_inicio: "",
  fecha_fin: "",
  estado: "ACTIVA"
};

export default function Pagos({ token, rol }) {
  const [pestana, setPestana] = useState("registro");

  // Estados de registro de pagos.
  const [documento, setDocumento] = useState("");
  const [cliente, setCliente] = useState(null);
  const [vehiculoId, setVehiculoId] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  // Estados del historial.
  const [pagos, setPagos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [filtros, setFiltros] = useState({
    documento: "", placa: "", estado: "", desde: "", hasta: ""
  });
  const [errorHistorial, setErrorHistorial] = useState("");

  // Estados de gestión de tarifas.
  const [tiposVehiculo, setTiposVehiculo] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [formularioTarifa, setFormularioTarifa] = useState(formularioInicial);
  const [tarifaEditando, setTarifaEditando] = useState(null);
  const [cargandoTarifas, setCargandoTarifas] = useState(false);
  const [guardandoTarifa, setGuardandoTarifa] = useState(false);
  const [errorTarifas, setErrorTarifas] = useState("");
  const [mensajeTarifas, setMensajeTarifas] = useState("");

  const esAdministrador = rol === "ADMINISTRADOR";

  const vehiculoSeleccionado = useMemo(
    () => cliente?.vehiculos?.find(
      (v) => String(v.id) === String(vehiculoId)
    ) || null,
    [cliente, vehiculoId]
  );

  const mensualidad = vehiculoSeleccionado?.mensualidad || null;
const pagoPendiente = mensualidad?.estado_pago === "PENDIENTE";
const pagoRegistrado = mensualidad?.estado_pago === "PAGADO";
const mensualidadCancelada = mensualidad?.estado === "CANCELADA";

  const solicitar = useCallback(async (url, opciones = {}) => {
    const respuesta = await fetch(`${API_URL}${url}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opciones.headers || {})
      }
    });

    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !resultado.ok) {
      throw new Error(resultado.mensaje || "No fue posible completar la operación.");
    }

    return resultado;
  }, [token]);

  // ---------------- REGISTRO DE PAGOS ----------------

  async function buscarCliente(event) {
    event.preventDefault();

    if (!documento.trim()) {
      setMensaje("Ingresa el documento del cliente.");
      setTipoMensaje("error");
      return;
    }

    setBuscando(true);
    setCliente(null);
    setVehiculoId("");
    setMensaje("");

    try {
      const resultado = await solicitar(
        `/clientes/consulta/${encodeURIComponent(documento.trim())}`
      );

      if (!resultado.encontrado) {
        throw new Error("No se encontró un cliente con ese documento.");
      }

      setCliente(resultado.data);
      setTipoMensaje("success");
      setMensaje("Cliente encontrado. Selecciona el vehículo para consultar su cuenta de cobro.");
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setBuscando(false);
    }
  }

  async function registrarPago(event) {
    event.preventDefault();

    if (!mensualidad?.id) {
      setMensaje("El vehículo no tiene una mensualidad registrada para cobrar.");
      setTipoMensaje("error");
      return;
    }

    if (mensualidad.estado === "CANCELADA") {
      setMensaje("No se puede pagar una mensualidad cancelada.");
      setTipoMensaje("error");
      return;
    }

    setRegistrando(true);
    setMensaje("");

    try {
      const resultado = await solicitar("/pagos", {
        method: "POST",
        body: JSON.stringify({
          suscripcion_id: mensualidad.id,
          valor: mensualidad.valor,
          metodo_pago: metodo,
          referencia
        })
      });

      setTipoMensaje("success");
      setMensaje(resultado.mensaje);
      imprimirComprobante(resultado.data);
      setReferencia("");

      const actualizado = await solicitar(
        `/clientes/consulta/${encodeURIComponent(documento.trim())}`
      );

      if (actualizado.encontrado) {
        setCliente(actualizado.data);
      }
    } catch (error) {
      setTipoMensaje("error");
      setMensaje(error.message);
    } finally {
      setRegistrando(false);
    }
  }

  // ---------------- HISTORIAL DE PAGOS ----------------

  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    setErrorHistorial("");

    try {
      const params = new URLSearchParams();

      Object.entries(filtros).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const resultado = await solicitar(`/pagos?${params.toString()}`);
      setPagos(resultado.data || []);
    } catch (error) {
      setErrorHistorial(error.message);
    } finally {
      setCargandoHistorial(false);
    }
  }, [
    solicitar,
    filtros.documento,
    filtros.placa,
    filtros.estado,
    filtros.desde,
    filtros.hasta
  ]);

  useEffect(() => {
    if (pestana === "historial") cargarHistorial();
  }, [pestana, cargarHistorial]);

  async function anularPago(pago) {
    const motivo = window.prompt(
      `Motivo para anular el comprobante ${pago.numero_comprobante}:`
    );

    if (motivo === null) return;

    if (motivo.trim().length < 5) {
      setErrorHistorial("El motivo debe tener al menos 5 caracteres.");
      return;
    }

    try {
      await solicitar(`/pagos/${pago.id}/anular`, {
        method: "PATCH",
        body: JSON.stringify({ motivo })
      });

      await cargarHistorial();
    } catch (error) {
      setErrorHistorial(error.message);
    }
  }

  // ---------------- GESTIÓN DE TARIFAS ----------------

  const cargarTarifas = useCallback(async () => {
    setCargandoTarifas(true);
    setErrorTarifas("");

    try {
      const [resultadoTipos, resultadoTarifas] = await Promise.all([
        solicitar("/tarifas/tipos-vehiculo"),
        solicitar("/tarifas")
      ]);

      setTiposVehiculo(resultadoTipos.data || []);
      setTarifas(resultadoTarifas.data || []);
    } catch (error) {
      setErrorTarifas(error.message);
    } finally {
      setCargandoTarifas(false);
    }
  }, [solicitar]);

  useEffect(() => {
    if (pestana === "tarifas" && esAdministrador) {
      cargarTarifas();
    }
  }, [pestana, esAdministrador, cargarTarifas]);

  function cambiarCampoTarifa(event) {
    const { name, value } = event.target;

    setFormularioTarifa((actual) => ({
      ...actual,
      [name]: value
    }));
  }

  function prepararEdicion(tarifa) {
    setTarifaEditando(tarifa.id);

    setFormularioTarifa({
      tipo_vehiculo_id: String(tarifa.tipo_vehiculo_id),
      valor: String(tarifa.valor),
      fecha_inicio: fecha(tarifa.fecha_inicio),
      fecha_fin: fecha(tarifa.fecha_fin) === "—" ? "" : fecha(tarifa.fecha_fin),
      estado: tarifa.estado
    });

    setMensajeTarifas("");
    setErrorTarifas("");
  }

  function cancelarEdicion() {
    setTarifaEditando(null);
    setFormularioTarifa(formularioInicial);
    setMensajeTarifas("");
  }

  async function guardarTarifa(event) {
    event.preventDefault();

    setGuardandoTarifa(true);
    setErrorTarifas("");
    setMensajeTarifas("");

    try {
      const datos = {
        ...formularioTarifa,
        tipo_vehiculo_id: Number(formularioTarifa.tipo_vehiculo_id),
        valor: Number(formularioTarifa.valor),
        fecha_fin: formularioTarifa.fecha_fin || null
      };

      const editando = Boolean(tarifaEditando);

      const resultado = await solicitar(
        editando ? `/tarifas/${tarifaEditando}` : "/tarifas",
        {
          method: editando ? "PUT" : "POST",
          body: JSON.stringify(datos)
        }
      );

      setMensajeTarifas(resultado.mensaje);
      setTarifaEditando(null);
      setFormularioTarifa(formularioInicial);

      await cargarTarifas();
    } catch (error) {
      setErrorTarifas(error.message);
    } finally {
      setGuardandoTarifa(false);
    }
  }

  async function cambiarEstado(tarifa) {
    const nuevoEstado = tarifa.estado === "ACTIVA" ? "INACTIVA" : "ACTIVA";

    const confirmar = window.confirm(
      `¿Deseas ${nuevoEstado === "ACTIVA" ? "activar" : "inactivar"} la tarifa de ${tarifa.nombre}?`
    );

    if (!confirmar) return;

    setErrorTarifas("");
    setMensajeTarifas("");

    try {
      const resultado = await solicitar(`/tarifas/${tarifa.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado })
      });

      setMensajeTarifas(resultado.mensaje);
      await cargarTarifas();
    } catch (error) {
      setErrorTarifas(error.message);
    }
  }

  // ---------------- INTERFAZ ----------------

  return (
    <div className="pagos-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN FINANCIERA</p>
          <h2>Gestión de pagos</h2>
          <p className="page-description">
            Registra pagos de mensualidades, genera comprobantes y consulta el historial.
          </p>
        </div>
      </div>

      <div className="pagos-tabs">
        <button
          type="button"
          className={pestana === "registro" ? "active" : ""}
          onClick={() => setPestana("registro")}
        >
          Registrar pago
        </button>

        <button
          type="button"
          className={pestana === "historial" ? "active" : ""}
          onClick={() => setPestana("historial")}
        >
          Historial de pagos
        </button>

        {esAdministrador && (
          <button
            type="button"
            className={pestana === "tarifas" ? "active" : ""}
            onClick={() => setPestana("tarifas")}
          >
            Gestión de tarifas
          </button>
        )}
      </div>

      {/* REGISTRO DE PAGOS */}

      {pestana === "registro" && (
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>Registrar pago mensual</h3>
              <p>Busca al cliente y selecciona el vehículo cuya mensualidad deseas cobrar.</p>
            </div>
          </div>

          <form onSubmit={buscarCliente}>
            <div className="form-grid">
              <label className="field">
                <span>Documento del cliente *</span>
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Número de documento"
                  required
                />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={buscando}>
                {buscando ? "Buscando..." : "Buscar cliente"}
              </button>
            </div>
          </form>

          {mensaje && (
            <div className={`form-message ${tipoMensaje}`} role="alert">
              {mensaje}
            </div>
          )}

          {cliente && (
            <div className="pagos-client-info">
              <h3>Información del cliente</h3>
              <p><strong>Nombre:</strong> {cliente.nombre_razon_social}</p>
              <p>
                <strong>Documento:</strong> {cliente.tipo_documento} {cliente.numero_documento}
              </p>

              <label className="field">
                <span>Vehículo *</span>
                <select
                  value={vehiculoId}
                  onChange={(e) => setVehiculoId(e.target.value)}
                >
                  <option value="">Selecciona un vehículo</option>
                  {(cliente.vehiculos || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} - {v.tipo} | 
                      {v.mensualidad?.estado || "SIN MENSUALIDAD"} | 
                      {v.mensualidad?.estado_pago || "SIN PAGO"}
                    </option>
                  ))}
                </select>
              </label>

              {vehiculoSeleccionado && (
                <div className="pagos-vehicle-info">
                  <h4>Cuenta de cobro</h4>

                  <div className="pagos-detail-grid">
                    <p><strong>Placa:</strong> {vehiculoSeleccionado.placa}</p>
                    <p><strong>Tipo:</strong> {vehiculoSeleccionado.tipo}</p>
                    <p><strong>Mensualidad:</strong> {mensualidad?.id ? `#${mensualidad.id}` : "Sin mensualidad"}</p>
                    <p><strong>Estado:</strong> {mensualidad?.estado || "Sin mensualidad registrada"}</p>
                    <p><strong>Fecha de inicio:</strong> {fecha(mensualidad?.fecha_inicio)}</p>
                    <p><strong>Fecha de vencimiento:</strong> {fecha(mensualidad?.fecha_fin)}</p>
                    <p><strong>Estado de vigencia:</strong> {mensualidad?.estado || "Sin mensualidad"}</p>
                    <p>
                      <strong>Estado de pago:</strong>
                      {mensualidad?.estado_pago || "SIN REGISTRO"}
                    </p>
                    {mensualidad?.numero_comprobante && (
                      <p>
                        <strong>Comprobante:</strong>
                        {mensualidad.numero_comprobante}
                      </p>
                    )}
                  </div>

                  {mensualidad && (
                    <div className="pagos-amount">
                      <span>Valor de la mensualidad</span>
                      <strong>{moneda(mensualidad.valor)}</strong>
                    </div>
                  )}

                  {!mensualidad && (
                    <p className="pagos-notice">
                      Este vehículo no tiene una mensualidad registrada.
                    </p>
                  )}
                </div>
              )}

              {mensualidad && pagoPendiente && !mensualidadCancelada && (
                <form className="pagos-payment-form" onSubmit={registrarPago}>
                  <h4>Datos del pago</h4>

                  <div className="form-grid">
                    <label className="field">
                      <span>Valor a pagar</span>
                      <input value={moneda(mensualidad.valor)} readOnly />
                    </label>

                    <label className="field">
                      <span>Método de pago *</span>
                      <select
                        value={metodo}
                        onChange={(e) => setMetodo(e.target.value)}
                        required
                      >
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                        <option value="TARJETA">Tarjeta</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Referencia de transacción (opcional)</span>
                      <input
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                        maxLength={120}
                        placeholder="Número de referencia"
                      />
                    </label>
                  </div>

                  <p className="pagos-help">
                    El sistema validará el valor y que no exista otro pago aprobado para esta mensualidad.
                    Si las validaciones son correctas, el pago se aprobará automáticamente.
                  </p>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={registrando || !mensualidad.id || mensualidad.estado === "CANCELADA"}
                    >
                      {registrando ? "Registrando..." : "Registrar y aprobar pago"}
                    </button>
                  </div>
                </form>
              )}

              {cliente.vehiculos?.length === 0 && (
                <p className="pagos-notice">
                  Este cliente no tiene vehículos asociados.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* HISTORIAL DE PAGOS */}

      {pestana === "historial" && (
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>Historial de pagos</h3>
              <p>Consulta y recupera comprobantes de las transacciones registradas.</p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={cargarHistorial}
              disabled={cargandoHistorial}
            >
              {cargandoHistorial ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div className="pagos-filters">
            <label className="field">
              <span>Documento</span>
              <input
                value={filtros.documento}
                onChange={(e) => setFiltros((f) => ({ ...f, documento: e.target.value }))}
              />
            </label>

            <label className="field">
              <span>Placa</span>
              <input
                value={filtros.placa}
                onChange={(e) => setFiltros((f) => ({ ...f, placa: e.target.value }))}
              />
            </label>

            <label className="field">
              <span>Estado</span>
              <select
                value={filtros.estado}
                onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="APROBADO">Aprobado</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </label>

            <label className="field">
              <span>Desde</span>
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
              />
            </label>

            <label className="field">
              <span>Hasta</span>
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
              />
            </label>

            <button
              type="button"
              className="primary-button"
              onClick={cargarHistorial}
              disabled={cargandoHistorial}
            >
              Filtrar
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setFiltros({
                documento: "", placa: "", estado: "", desde: "", hasta: ""
              })}
            >
              Limpiar
            </button>
          </div>

          {errorHistorial && (
            <div className="form-message error">{errorHistorial}</div>
          )}

          {cargandoHistorial ? (
            <p className="pagos-empty">Cargando historial...</p>
          ) : pagos.length === 0 ? (
            <p className="pagos-empty">No hay pagos que coincidan con los filtros.</p>
          ) : (
            <div className="pagos-table-wrap">
              <table className="pagos-table">
                <thead>
                  <tr>
                    <th>Comprobante</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Vehículo</th>
                    <th>Valor</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th>Responsable</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.numero_comprobante}</td>
                      <td>{fecha(p.fecha_pago)}</td>
                      <td>{p.cliente}<small>{p.numero_documento}</small></td>
                      <td>{p.placa}<small>{p.tipo}</small></td>
                      <td>{moneda(p.valor)}</td>
                      <td>{p.metodo_pago}</td>
                      <td>
                        <span className={`pagos-status ${p.estado.toLowerCase()}`}>
                          {p.estado}
                        </span>
                      </td>
                      <td>{p.responsable || "—"}</td>
                      <td>
                        <div className="pagos-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => imprimirComprobante(p)}
                          >
                            Comprobante
                          </button>

                          {esAdministrador && p.estado === "APROBADO" && (
                            <button
                              type="button"
                              className="text-button danger"
                              onClick={() => anularPago(p)}
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* GESTIÓN DE TARIFAS */}

      {pestana === "tarifas" && esAdministrador && (
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>Gestión de tarifas</h3>
              <p>
                Configura los valores de las mensualidades según el tipo de vehículo y su vigencia.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={cargarTarifas}
              disabled={cargandoTarifas}
            >
              {cargandoTarifas ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {errorTarifas && (
            <div className="form-message error">{errorTarifas}</div>
          )}

          {mensajeTarifas && (
            <div className="form-message success">{mensajeTarifas}</div>
          )}

          <h4>{tarifaEditando ? "Editar tarifa" : "Registrar nueva tarifa"}</h4>

          <form onSubmit={guardarTarifa}>
            <div className="form-grid">
              <label className="field">
                <span>Tipo de vehículo *</span>
                <select
                  name="tipo_vehiculo_id"
                  value={formularioTarifa.tipo_vehiculo_id}
                  onChange={cambiarCampoTarifa}
                  required
                  disabled={Boolean(tarifaEditando)}
                >
                  <option value="">Selecciona un tipo</option>
                  {tiposVehiculo.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Valor de la tarifa (COP) *</span>
                <input
                  type="number"
                  name="valor"
                  value={formularioTarifa.valor}
                  onChange={cambiarCampoTarifa}
                  min="1"
                  step="0.01"
                  placeholder="Ej. 150000"
                  required
                />
              </label>

              <label className="field">
                <span>Fecha de inicio *</span>
                <input
                  type="date"
                  name="fecha_inicio"
                  value={formularioTarifa.fecha_inicio}
                  onChange={cambiarCampoTarifa}
                  required
                />
              </label>

              <label className="field">
                <span>Fecha de finalización</span>
                <input
                  type="date"
                  name="fecha_fin"
                  value={formularioTarifa.fecha_fin}
                  onChange={cambiarCampoTarifa}
                />
              </label>

              <label className="field">
                <span>Estado *</span>
                <select
                  name="estado"
                  value={formularioTarifa.estado}
                  onChange={cambiarCampoTarifa}
                  required
                >
                  <option value="ACTIVA">Activa</option>
                  <option value="INACTIVA">Inactiva</option>
                </select>
              </label>
            </div>

            <p className="pagos-help">
              Si no defines una fecha de finalización, la tarifa tendrá vigencia indefinida.
              No se permiten períodos superpuestos entre tarifas activas del mismo tipo.
            </p>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={guardandoTarifa}
              >
                {guardandoTarifa
                  ? "Guardando..."
                  : tarifaEditando
                    ? "Guardar cambios"
                    : "Registrar tarifa"}
              </button>

              {tarifaEditando && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelarEdicion}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>

          <div className="form-section-heading" style={{ marginTop: "32px" }}>
            <div>
              <h3>Tarifas registradas</h3>
              <p>Consulta las tarifas y administra su estado.</p>
            </div>
          </div>

          {cargandoTarifas ? (
            <p className="pagos-empty">Cargando tarifas...</p>
          ) : tarifas.length === 0 ? (
            <p className="pagos-empty">Todavía no hay tarifas registradas.</p>
          ) : (
            <div className="pagos-table-wrap">
              <table className="pagos-table">
                <thead>
                  <tr>
                    <th>Tipo de vehículo</th>
                    <th>Valor</th>
                    <th>Fecha de inicio</th>
                    <th>Fecha de finalización</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifas.map((tarifa) => (
                    <tr key={tarifa.id}>
                      <td>{tarifa.nombre}</td>
                      <td>{moneda(tarifa.valor)}</td>
                      <td>{fecha(tarifa.fecha_inicio)}</td>
                      <td>{fecha(tarifa.fecha_fin)}</td>
                      <td>
                        <span className={`pagos-status ${tarifa.estado.toLowerCase()}`}>
                          {tarifa.estado}
                        </span>
                      </td>
                      <td>
                        <div className="pagos-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => prepararEdicion(tarifa)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="text-button"
                            onClick={() => cambiarEstado(tarifa)}
                          >
                            {tarifa.estado === "ACTIVA" ? "Inactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
