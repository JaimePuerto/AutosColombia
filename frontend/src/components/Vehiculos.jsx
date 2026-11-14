import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";

const API_URL = "http://localhost:3001/api";

const formularioInicial = {
  placa: "",
  tipo: "CARRO",
  cliente_id: "",
  marca: "",
  modelo: "",
  color: "",
  anio: "",
};

function Vehiculos({ token }) {
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [vehiculoEditando, setVehiculoEditando] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [titular, setTitular] = useState(null);
  const [titularForm, setTitularForm] = useState({ cliente_id: "", motivo: "" });

  function authHeader(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    };
  }

  function mostrarMensaje(texto, tipo = "success") {
    setMensaje(texto);
    setTipoMensaje(tipo);
  }

  async function consultarClientes() {
    try {
      const respuesta = await fetch(`${API_URL}/clientes?activo=true`, {
        headers: authHeader(),
      });

      if (respuesta.status === 401) {
        sessionStorage.removeItem("autoscolombia_token");
        window.location.reload();
        return;
      }

      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.ok) setClientes(resultado.data || []);
    } catch {
      /* el listado de clientes es auxiliar: si falla, se permite escribir el id */
    }
  }

  async function consultarVehiculos() {
    setCargando(true);

    try {
      const parametros = new URLSearchParams();
      if (busqueda.trim()) parametros.set("buscar", busqueda.trim());
      if (filtroTipo !== "TODOS") parametros.set("tipo", filtroTipo);
      if (filtroEstado !== "TODOS") {
        parametros.set("activo", filtroEstado === "ACTIVOS" ? "true" : "false");
      }

      const respuesta = await fetch(
        `${API_URL}/vehiculos?${parametros.toString()}`,
        { headers: authHeader() }
      );

      if (respuesta.status === 401) {
        sessionStorage.removeItem("autoscolombia_token");
        window.location.reload();
        return;
      }

      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) {
        throw new Error(resultado.mensaje || "No fue posible consultar los vehículos.");
      }

      // HU-07: los filtros de tipo y estado se resuelven en el backend (SQL).
      setVehiculos(resultado.data || []);
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    consultarClientes();
  }, []);

  useEffect(() => {
    consultarVehiculos();
  }, [busqueda, filtroTipo, filtroEstado]);

  function actualizarCampo(event) {
    const { name, value } = event.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: name === "placa" ? value.toUpperCase().replace(/\s/g, "") : value,
    }));
  }

  function nuevoVehiculo() {
    setFormulario(formularioInicial);
    setVehiculoEditando(null);
    setMostrarFormulario(true);
    setMensaje("");
  }

  function editarVehiculo(vehiculo) {
    setFormulario({
      placa: vehiculo.placa || "",
      tipo: vehiculo.tipo || "CARRO",
      cliente_id: vehiculo.cliente_id ? String(vehiculo.cliente_id) : "",
      marca: vehiculo.marca || "",
      modelo: vehiculo.modelo || "",
      color: vehiculo.color || "",
      anio: vehiculo.anio ? String(vehiculo.anio) : "",
    });

    setVehiculoEditando(vehiculo);
    setMostrarFormulario(true);
    setMensaje("");
  }

  function cancelarFormulario() {
    setMostrarFormulario(false);
    setVehiculoEditando(null);
    setFormulario(formularioInicial);
    setMensaje("");
  }

  async function guardarVehiculo(event) {
    event.preventDefault();
    setGuardando(true);
    setMensaje("");

    try {
      const esEdicion = Boolean(vehiculoEditando);
      const cuerpo = {
        ...formulario,
        anio: formulario.anio === "" ? null : Number(formulario.anio),
      };

      const respuesta = await fetch(
        esEdicion ? `${API_URL}/vehiculos/${vehiculoEditando.id}` : `${API_URL}/vehiculos`,
        {
          method: esEdicion ? "PUT" : "POST",
          headers: authHeader(true),
          body: JSON.stringify(cuerpo),
        }
      );

      if (respuesta.status === 401) {
        sessionStorage.removeItem("autoscolombia_token");
        window.location.reload();
        return;
      }

      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) {
        throw new Error(resultado.mensaje || "No fue posible guardar el vehículo.");
      }

      setMostrarFormulario(false);
      setVehiculoEditando(null);
      setFormulario(formularioInicial);
      mostrarMensaje(
        esEdicion ? "Vehículo actualizado correctamente." : "Vehículo registrado correctamente."
      );

      await consultarVehiculos();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(vehiculo) {
    const activo = Boolean(vehiculo.activo);

    const confirmacion = window.confirm(
      activo
        ? `¿Deseas inactivar el vehículo ${vehiculo.placa}?`
        : `¿Deseas activar el vehículo ${vehiculo.placa}?`
    );

    if (!confirmacion) return;

    try {
      const respuesta = await fetch(`${API_URL}/vehiculos/${vehiculo.id}/estado`, {
        method: "PATCH",
        headers: authHeader(true),
        body: JSON.stringify({ activo: !activo }),
      });

      if (respuesta.status === 401) {
        sessionStorage.removeItem("autoscolombia_token");
        window.location.reload();
        return;
      }

      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) {
        throw new Error(resultado.mensaje || "No fue posible cambiar el estado del vehículo.");
      }

      mostrarMensaje(
        activo ? "Vehículo inactivado correctamente." : "Vehículo activado correctamente."
      );

      await consultarVehiculos();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    }
  }

  // RF-01: las camionetas usan el mismo formato de placa que los carros.
  const esCarro = formulario.tipo === "CARRO" || formulario.tipo === "CAMIONETA";

  // RF-27: cambio de titular con trazabilidad. No se modifica la placa ni el
  // historial de movimientos; el titular anterior queda registrado en la tabla
  // histórica del backend.
  function abrirTitular(vehiculo) {
    setTitular(vehiculo);
    setTitularForm({ cliente_id: "", motivo: "" });
    setMensaje("");
  }

  async function confirmarTitular(event) {
    event.preventDefault();
    if (!titularForm.cliente_id) {
      mostrarMensaje("Selecciona el nuevo titular.", "error");
      return;
    }
    if (titularForm.motivo.trim().length < 5) {
      mostrarMensaje("Indica un motivo de al menos 5 caracteres.", "error");
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await fetch(`${API_URL}/vehiculos/${titular.id}/cambiar-titular`, {
        method: "POST",
        headers: authHeader(true),
        body: JSON.stringify({ cliente_id: Number(titularForm.cliente_id), motivo: titularForm.motivo.trim() }),
      });
      if (respuesta.status === 401) {
        sessionStorage.removeItem("autoscolombia_token");
        window.location.reload();
        return;
      }
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) throw new Error(resultado.mensaje || "No fue posible cambiar el titular.");
      setTitular(null);
      mostrarMensaje("Titular actualizado correctamente.");
      await consultarVehiculos();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN DE PARQUEADERO</p>
          <h2>Vehículos</h2>
          <p className="page-description">
            Registra y administra los vehículos antes de autorizar su ingreso.
          </p>
        </div>

        <button className="primary-button" onClick={nuevoVehiculo}>
          + Nuevo vehículo
        </button>
      </div>

      {mensaje && (
        <div className={`form-message ${tipoMensaje}`} role="alert">
          {mensaje}
        </div>
      )}

      {mostrarFormulario && (
        <Modal label={vehiculoEditando ? "Editar vehículo" : "Registrar vehículo"} onClose={cancelarFormulario} message={tipoMensaje === "error" ? mensaje : ""}>
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>{vehiculoEditando ? "Editar vehículo" : "Registrar vehículo"}</h3>
              <p>El vehículo debe estar registrado antes de registrar su entrada.</p>
            </div>
          </div>

          <form onSubmit={guardarVehiculo}>
            <div className="form-grid">
              <label className="field">
                <span>Tipo de vehículo *</span>
                <select name="tipo" value={formulario.tipo} onChange={actualizarCampo} required>
                  <option value="CARRO">Carro</option>
                  <option value="MOTO">Moto</option>
                  <option value="CAMIONETA">Camioneta</option>
                </select>
              </label>

              <label className="field">
                <span>Placa *</span>
                <input
                  name="placa"
                  value={formulario.placa}
                  onChange={actualizarCampo}
                  placeholder={esCarro ? "ABC123" : "ABC12D"}
                  maxLength={6}
                  required
                />
                <small>
                  {esCarro
                    ? "3 letras y 3 números."
                    : "3 letras, 2 números y una letra final."}
                </small>
              </label>

              <label className="field">
                <span>Cliente propietario *</span>
                <select
                  name="cliente_id"
                  value={formulario.cliente_id}
                  onChange={actualizarCampo}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre_razon_social} — {cliente.numero_documento}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Marca *</span>
                <input
                  name="marca"
                  value={formulario.marca}
                  onChange={actualizarCampo}
                  placeholder="Marca del vehículo"
                  maxLength={50}
                  required
                />
              </label>

              <label className="field">
                <span>Modelo *</span>
                <input
                  name="modelo"
                  value={formulario.modelo}
                  onChange={actualizarCampo}
                  placeholder="Línea o modelo"
                  maxLength={50}
                  required
                />
              </label>

              <label className="field">
                <span>Color *</span>
                <input
                  name="color"
                  value={formulario.color}
                  onChange={actualizarCampo}
                  placeholder="Color del vehículo"
                  maxLength={30}
                  required
                />
              </label>

              <label className="field">
                <span>Año</span>
                <input
                  type="number"
                  name="anio"
                  value={formulario.anio}
                  onChange={actualizarCampo}
                  placeholder="Año de fabricación"
                  min={1886}
                  max={2100}
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={cancelarFormulario}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button type="submit" className="primary-button" disabled={guardando}>
                {guardando
                  ? "Guardando..."
                  : vehiculoEditando
                    ? "Guardar cambios"
                    : "Registrar vehículo"}
              </button>
            </div>
          </form>
        </section>
        </Modal>
      )}

      {titular && (
        <Modal label={`Cambiar titular del vehículo ${titular.placa}`} onClose={() => setTitular(null)} message={tipoMensaje === "error" ? mensaje : ""}>
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>Cambiar titular — {titular.placa}</h3>
              <p>El vehículo y su historial se conservan. El titular anterior queda registrado para trazabilidad.</p>
            </div>
          </div>
          <form onSubmit={confirmarTitular}>
            <div className="form-grid">
              <label className="field">
                <span>Nuevo titular *</span>
                <select
                  value={titularForm.cliente_id}
                  onChange={(event) => setTitularForm((v) => ({ ...v, cliente_id: event.target.value }))}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre_razon_social} — {cliente.numero_documento}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Motivo del cambio *</span>
                <input
                  value={titularForm.motivo}
                  onChange={(event) => setTitularForm((v) => ({ ...v, motivo: event.target.value }))}
                  maxLength={500}
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setTitular(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={guardando || titularForm.motivo.trim().length < 5}>
                {guardando ? "Guardando..." : "Confirmar cambio de titular"}
              </button>
            </div>
          </form>
        </section>
        </Modal>
      )}

      <section className="panel recent-panel history-panel">
        <div className="history-toolbar">
          <div>
            <h3>Vehículos registrados</h3>
            <p>{vehiculos.length} vehículos encontrados</p>
          </div>

          <div className="history-filters">
            <input
              className="search-input"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por placa, marca o cliente..."
            />

            <select
              className="search-input"
              value={filtroTipo}
              onChange={(event) => setFiltroTipo(event.target.value)}
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="CARRO">Carros</option>
              <option value="MOTO">Motos</option>
              <option value="CAMIONETA">Camionetas</option>
            </select>

            <select
              className="search-input"
              value={filtroEstado}
              onChange={(event) => setFiltroEstado(event.target.value)}
            >
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVOS">Activos</option>
              <option value="INACTIVOS">Inactivos</option>
            </select>
          </div>
        </div>

        {cargando ? (
          <p className="empty-state">Consultando vehículos...</p>
        ) : vehiculos.length === 0 ? (
          <p className="empty-state">No hay vehículos que coincidan con la búsqueda.</p>
        ) : (
          <div className="table-wrapper">
            <table className="movement-table">
              <thead>
                <tr>
                  <th>PLACA</th>
                  <th>TIPO</th>
                  <th>CLIENTE</th>
                  <th>MARCA / MODELO</th>
                  <th>COLOR</th>
                  <th>AÑO</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>

              <tbody>
                {vehiculos.map((vehiculo) => {
                  const activo = Boolean(vehiculo.activo);

                  return (
                    <tr key={vehiculo.id}>
                      <td>
                        <strong className="plate-value">{vehiculo.placa}</strong>
                      </td>
                      <td>{vehiculo.tipo === "CARRO" ? "Carro" : vehiculo.tipo === "CAMIONETA" ? "Camioneta" : "Moto"}</td>
                      <td>{vehiculo.cliente || "Sin cliente"}</td>
                      <td>
                        {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td>{vehiculo.color || "—"}</td>
                      <td>{vehiculo.anio || "—"}</td>
                      <td>
                        <span className={`pill ${activo ? "active-pill" : "neutral"}`}>
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="client-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => editarVehiculo(vehiculo)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="text-button"
                            onClick={() => abrirTitular(vehiculo)}
                          >
                            Cambiar titular
                          </button>

                          <button
                            type="button"
                            className="text-button"
                            onClick={() => cambiarEstado(vehiculo)}
                          >
                            {activo ? "Inactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default Vehiculos;
