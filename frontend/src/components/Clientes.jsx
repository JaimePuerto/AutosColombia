
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";

const API_URL = "http://localhost:3001/api";
const authHeader = () => ({ Authorization: `Bearer ${sessionStorage.getItem("autoscolombia_token") || ""}` });

const formularioInicial = {
  tipo_cliente: "PERSONA",
  tipo_documento: "CC",
  numero_documento: "",
  nombre_razon_social: "",
  nombres: "",
  apellidos: "",
  telefono: "",
  correo: "",
  direccion: "",
};

// RNF-11: la consulta está disponible para operador y administrador; la modificación
// queda habilitada únicamente para el administrador (el backend la restringe con 403).
function Clientes({ rol }) {
  const esAdministrador = rol === "ADMINISTRADOR";
  const [clientes, setClientes] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [clienteEditando, setClienteEditando] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");

  // RF-22: consulta por documento con vehículos y estado de mensualidad.
  const [consultaDoc, setConsultaDoc] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [consultando, setConsultando] = useState(false);

  // RF-23: registro transaccional cliente + vehículo(s) + autorización de datos.
  const [vehiculosNuevo, setVehiculosNuevo] = useState([{ placa: "", tipo: "CARRO", marca: "", modelo: "", color: "", anio: "" }]);
  const [autorizacion, setAutorizacion] = useState(false);

  function mostrarMensaje(texto, tipo = "success") {
    setMensaje(texto);
    setTipoMensaje(tipo);
  }

  // RF-22: consulta un cliente por documento e informa vehículos y mensualidades.
  async function consultarDocumento(event) {
    if (event) event.preventDefault();
    const documento = consultaDoc.trim();

    if (!documento) {
      mostrarMensaje("Debes indicar un número de documento.", "error");
      return;
    }

    setConsultando(true);
    setConsulta(null);

    try {
      const respuesta = await fetch(
        `${API_URL}/clientes/consulta/${encodeURIComponent(documento)}`,
        { headers: authHeader() }
      );

      if (respuesta.status === 401) { sessionStorage.removeItem("autoscolombia_token"); window.location.reload(); return; }
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        throw new Error(resultado.mensaje || "No fue posible consultar el documento.");
      }

      setConsulta({ encontrado: Boolean(resultado.encontrado), data: resultado.data });
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setConsultando(false);
    }
  }

  function actualizarVehiculo(index, campo, valor) {
    setVehiculosNuevo((anterior) =>
      anterior.map((vehiculo, i) => (i === index ? { ...vehiculo, [campo]: valor } : vehiculo))
    );
  }

  function agregarVehiculo() {
    setVehiculosNuevo((anterior) => [
      ...anterior,
      { placa: "", tipo: "CARRO", marca: "", modelo: "", color: "", anio: "" },
    ]);
  }

  function quitarVehiculo(index) {
    setVehiculosNuevo((anterior) => anterior.filter((_, i) => i !== index));
  }

  async function consultarClientes() {
    setCargando(true);

    try {
      const parametros = new URLSearchParams();

      if (busqueda.trim()) {
        parametros.set("buscar", busqueda.trim());
      }

      if (filtroTipo !== "TODOS") {
        parametros.set("tipo", filtroTipo);
      }

      if (filtroEstado !== "TODOS") {
        parametros.set(
          "activo",
          filtroEstado === "ACTIVOS" ? "true" : "false"
        );
      }

      const respuesta = await fetch(
        `${API_URL}/clientes?${parametros.toString()}`,
        { headers: authHeader() }
      );

      if (respuesta.status === 401) { sessionStorage.removeItem("autoscolombia_token"); window.location.reload(); return; }
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        throw new Error(
          resultado.message || resultado.error || "No fue posible consultar los clientes."
        );
      }

      setClientes(resultado.data || []);
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    consultarClientes();
  }, [busqueda, filtroTipo, filtroEstado]);

  function actualizarCampo(event) {
    const { name, value } = event.target;

    setFormulario((anterior) => {
      // Al cambiar el tipo de cliente, asigna el documento predeterminado.
      // Persona natural: CC. Empresa: NIT.
      if (name === "tipo_cliente") {
        return {
          ...anterior,
          tipo_cliente: value,
          tipo_documento: value === "EMPRESA" ? "NIT" : "CC",
        };
      }

      return {
        ...anterior,
        [name]: value,
      };
    });
  }

  function nuevoCliente() {
    setFormulario(formularioInicial);
    setClienteEditando(null);
    setVehiculosNuevo([{ placa: "", tipo: "CARRO", marca: "", modelo: "", color: "", anio: "" }]);
    setAutorizacion(false);
    setMostrarFormulario(true);
    setMensaje("");
  }

  function editarCliente(cliente) {
    setFormulario({
      tipo_cliente: cliente.tipo_cliente || "PERSONA",
      tipo_documento: cliente.tipo_documento || "CC",
      numero_documento: cliente.numero_documento || "",
      nombre_razon_social: cliente.nombre_razon_social || "",
      nombres: cliente.nombres || "",
      apellidos: cliente.apellidos || "",
      telefono: cliente.telefono || "",
      correo: cliente.correo || "",
      direccion: cliente.direccion || "",
    });

    setClienteEditando(cliente);
    setMostrarFormulario(true);
    setMensaje("");
  }

  function cancelarFormulario() {
    setMostrarFormulario(false);
    setClienteEditando(null);
    setFormulario(formularioInicial);
    setVehiculosNuevo([{ placa: "", tipo: "CARRO", marca: "", modelo: "", color: "", anio: "" }]);
    setAutorizacion(false);
    setMensaje("");
  }

  async function guardarCliente(event) {
    event.preventDefault();
    setGuardando(true);
    setMensaje("");

    try {
      const esEdicion = Boolean(clienteEditando);

      // RF-23: el registro de un cliente nuevo exige al menos un vehículo
      // y la autorización de tratamiento de datos personales.
      if (!esEdicion) {
        if (!autorizacion) {
          throw new Error("Debes registrar la autorización de tratamiento de datos personales.");
        }
        const vehiculosValidos = vehiculosNuevo
          .filter((v) => v.placa.trim())
          .map((v) => ({
            placa: v.placa.trim().toUpperCase(),
            tipo: v.tipo,
            marca: v.marca || null,
            modelo: v.modelo || null,
            color: v.color || null,
            anio: v.anio === "" ? null : Number(v.anio),
          }));
        if (vehiculosValidos.length === 0) {
          throw new Error("Debes registrar al menos un vehículo junto con el cliente.");
        }

        const respuesta = await fetch(`${API_URL}/clientes/registro`, {
          method: "POST",
          headers: { ...authHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ cliente: formulario, vehiculos: vehiculosValidos, autorizacion: true }),
        });

        if (respuesta.status === 401) { sessionStorage.removeItem("autoscolombia_token"); window.location.reload(); return; }
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.ok) throw new Error(resultado.mensaje || resultado.message || "No fue posible registrar el cliente.");

        setMostrarFormulario(false);
        setFormulario(formularioInicial);
        setVehiculosNuevo([{ placa: "", tipo: "CARRO", marca: "", modelo: "", color: "", anio: "" }]);
        setAutorizacion(false);
        mostrarMensaje("Cliente y vehículo registrados correctamente.");
        await consultarClientes();
        return;
      }

      const respuesta = await fetch(
        `${API_URL}/clientes/${clienteEditando.id}`,
        {
          method: "PUT",
          headers: {
            ...authHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formulario),
        }
      );

      if (respuesta.status === 401) { sessionStorage.removeItem("autoscolombia_token"); window.location.reload(); return; }
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        throw new Error(
          resultado.message ||
            resultado.error ||
            "No fue posible guardar la información del cliente."
        );
      }

      setMostrarFormulario(false);
      setClienteEditando(null);
      setFormulario(formularioInicial);

      mostrarMensaje("Cliente actualizado correctamente.");

      await consultarClientes();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(cliente) {
    const activo = Boolean(cliente.activo);

    const confirmacion = window.confirm(
      activo
        ? `¿Deseas inactivar al cliente ${cliente.nombre_razon_social}?`
        : `¿Deseas activar al cliente ${cliente.nombre_razon_social}?`
    );

    if (!confirmacion) return;

    try {
      const respuesta = await fetch(
        `${API_URL}/clientes/${cliente.id}/estado`,
        {
          method: "PATCH",
          headers: {
            ...authHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ activo: !activo }),
        }
      );

      if (respuesta.status === 401) { sessionStorage.removeItem("autoscolombia_token"); window.location.reload(); return; }
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        throw new Error(
          resultado.message ||
            resultado.error ||
            "No fue posible cambiar el estado del cliente."
        );
      }

      mostrarMensaje(
        activo
          ? "Cliente inactivado correctamente."
          : "Cliente activado correctamente."
      );

      await consultarClientes();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN DE TERCEROS</p>
          <h2>Clientes</h2>
          <p className="page-description">
            Administra la información de las personas y empresas registradas.
          </p>
        </div>

        <button className="primary-button" onClick={nuevoCliente}>
          + Nuevo cliente
        </button>
      </div>

      {mensaje && (
        <div className={`form-message ${tipoMensaje}`} role="alert">
          {mensaje}
        </div>
      )}

      <section className="panel form-panel">
        <div className="form-section-heading">
          <div>
            <h3>Consulta por documento</h3>
            <p>Verifica si el cliente ya existe y consulta sus vehículos y mensualidades.</p>
          </div>
        </div>

        <form onSubmit={consultarDocumento}>
          <div className="form-grid">
            <label className="field">
              <span>Número de documento</span>
              <input
                value={consultaDoc}
                onChange={(event) => setConsultaDoc(event.target.value)}
                placeholder="Cédula, NIT o pasaporte"
                maxLength={30}
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="secondary-button" disabled={consultando}>
              {consultando ? "Consultando..." : "Consultar"}
            </button>
          </div>
        </form>

        {consulta && (
          consulta.encontrado ? (
            <div className="consulta-resultado">
              <p>
                <strong>{consulta.data.nombre_razon_social}</strong> — {consulta.data.tipo_documento}{" "}
                {consulta.data.numero_documento}
              </p>
              <p>
                Teléfono: {consulta.data.telefono || "—"} · Correo: {consulta.data.correo || "—"}
              </p>

              {consulta.data.vehiculos?.length ? (
                <div className="table-wrapper">
                  <table className="movement-table">
                    <thead>
                      <tr>
                        <th>PLACA</th>
                        <th>TIPO</th>
                        <th>MARCA</th>
                        <th>MODELO</th>
                        <th>MENSUALIDAD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consulta.data.vehiculos.map((vehiculo) => (
                        <tr key={vehiculo.id}>
                          <td><strong>{vehiculo.placa}</strong></td>
                          <td>{vehiculo.tipo}</td>
                          <td>{vehiculo.marca || "—"}</td>
                          <td>{vehiculo.modelo || "—"}</td>
                          <td>
                            {vehiculo.mensualidad
                              ? <span className="pill neutral">{vehiculo.mensualidad.estado}</span>
                              : "Sin mensualidad"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state">El cliente no tiene vehículos registrados.</p>
              )}
            </div>
          ) : (
            <p className="empty-state">
              No existe un cliente con ese documento. Puedes registrarlo con “Nuevo cliente”.
            </p>
          )
        )}
      </section>

      {mostrarFormulario && (
        <Modal label={clienteEditando ? "Editar cliente" : "Registrar cliente"} onClose={cancelarFormulario} message={tipoMensaje === "error" ? mensaje : ""}>
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>
                {clienteEditando ? "Editar cliente" : "Registrar cliente"}
              </h3>
              <p>Completa la información del cliente.</p>
            </div>
          </div>

          <form onSubmit={guardarCliente}>
            <div className="form-grid">
              <label className="field">
                <span>Tipo de cliente *</span>
                <select
                  name="tipo_cliente"
                  value={formulario.tipo_cliente}
                  onChange={actualizarCampo}
                  required
                >
                  <option value="PERSONA">Persona natural</option>
                  <option value="EMPRESA">Empresa</option>
                </select>
              </label>

              <label className="field">
                <span>Tipo de documento *</span>
                <select
                  name="tipo_documento"
                  value={formulario.tipo_documento}
                  onChange={actualizarCampo}
                  required
                >
                  <option value="CC">Cédula de ciudadanía</option>
                  <option value="CE">Cédula de extranjería</option>
                  <option value="NIT">NIT</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>

              <label className="field">
                <span>Número de documento *</span>
                <input
                  name="numero_documento"
                  value={formulario.numero_documento}
                  onChange={actualizarCampo}
                  placeholder="Número de identificación"
                  maxLength={30}
                  required
                />
              </label>

              {formulario.tipo_cliente === "EMPRESA" ? (
                <>
                  <label className="field">
                    <span>Razón social *</span>
                    <input
                      name="nombre_razon_social"
                      value={formulario.nombre_razon_social}
                      onChange={actualizarCampo}
                      placeholder="Nombre legal de la empresa"
                      maxLength={150}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Nombres de contacto *</span>
                    <input
                      name="nombres"
                      value={formulario.nombres}
                      onChange={actualizarCampo}
                      placeholder="Nombres de la persona de contacto"
                      maxLength={100}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Apellidos de contacto *</span>
                    <input
                      name="apellidos"
                      value={formulario.apellidos}
                      onChange={actualizarCampo}
                      placeholder="Apellidos de la persona de contacto"
                      maxLength={100}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Nombres *</span>
                    <input
                      name="nombres"
                      value={formulario.nombres}
                      onChange={actualizarCampo}
                      placeholder="Nombres del cliente"
                      maxLength={100}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Apellidos *</span>
                    <input
                      name="apellidos"
                      value={formulario.apellidos}
                      onChange={actualizarCampo}
                      placeholder="Apellidos del cliente"
                      maxLength={100}
                      required
                    />
                  </label>
                </>
              )}

              <label className="field">
                <span>Teléfono *</span>
                <input
                  name="telefono"
                  value={formulario.telefono}
                  onChange={actualizarCampo}
                  placeholder="Número de contacto"
                  maxLength={20}
                  required
                />
              </label>

              <label className="field">
                <span>Correo electrónico *</span>
                <input
                  type="email"
                  name="correo"
                  value={formulario.correo}
                  onChange={actualizarCampo}
                  placeholder="correo@ejemplo.com"
                  maxLength={150}
                  required
                />
              </label>

              <label className="field">
                <span>Dirección</span>
                <input
                  name="direccion"
                  value={formulario.direccion}
                  onChange={actualizarCampo}
                  placeholder="Dirección de residencia o empresa"
                  maxLength={200}
                />
              </label>
            </div>

            {!clienteEditando && (
              <div className="vehiculos-registro">
                <div className="form-section-heading">
                  <div>
                    <h4>Vehículos del cliente</h4>
                    <p>Registra al menos un vehículo. Todos los datos marcados son obligatorios.</p>
                  </div>
                  <button type="button" className="secondary-button" onClick={agregarVehiculo}>
                    + Agregar vehículo
                  </button>
                </div>

                {vehiculosNuevo.map((vehiculo, index) => (
                  <div className="form-grid" key={index}>
                    <label className="field">
                      <span>Placa *</span>
                      <input
                        value={vehiculo.placa}
                        onChange={(event) => actualizarVehiculo(index, "placa", event.target.value)}
                        placeholder="ABC123"
                        maxLength={7}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Tipo *</span>
                      <select
                        value={vehiculo.tipo}
                        onChange={(event) => actualizarVehiculo(index, "tipo", event.target.value)}
                        required
                      >
                        <option value="CARRO">Carro</option>
                        <option value="MOTO">Moto</option>
                        <option value="CAMIONETA">Camioneta</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Marca *</span>
                      <input
                        value={vehiculo.marca}
                        onChange={(event) => actualizarVehiculo(index, "marca", event.target.value)}
                        maxLength={50}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Modelo *</span>
                      <input
                        value={vehiculo.modelo}
                        onChange={(event) => actualizarVehiculo(index, "modelo", event.target.value)}
                        maxLength={50}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Color *</span>
                      <input
                        value={vehiculo.color}
                        onChange={(event) => actualizarVehiculo(index, "color", event.target.value)}
                        maxLength={30}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Año</span>
                      <input
                        type="number"
                        value={vehiculo.anio}
                        onChange={(event) => actualizarVehiculo(index, "anio", event.target.value)}
                        min={1950}
                        max={2100}
                      />
                    </label>

                    {vehiculosNuevo.length > 1 && (
                      <button type="button" className="text-button" onClick={() => quitarVehiculo(index)}>
                        Quitar
                      </button>
                    )}
                  </div>
                ))}

                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={autorizacion}
                      onChange={(event) => setAutorizacion(event.target.checked)}
                    />{" "}
                    El cliente autoriza el tratamiento de sus datos personales (RNF-12).
                  </span>
                </label>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={cancelarFormulario}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : clienteEditando
                    ? "Guardar cambios"
                    : "Registrar cliente"}
              </button>
            </div>
          </form>
        </section>
        </Modal>
      )}

      <section className="panel recent-panel history-panel">
        <div className="history-toolbar">
          <div>
            <h3>Directorio de clientes</h3>
            <p>{clientes.length} clientes encontrados</p>
          </div>

          <div className="history-filters">
            <input
              className="search-input"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar cliente o documento..."
            />

            <select
              className="search-input"
              value={filtroTipo}
              onChange={(event) => setFiltroTipo(event.target.value)}
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="PERSONA">Personas</option>
              <option value="EMPRESA">Empresas</option>
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
          <p className="empty-state">Consultando clientes...</p>
        ) : clientes.length === 0 ? (
          <p className="empty-state">
            No hay clientes que coincidan con la búsqueda.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="movement-table">
              <thead>
                <tr>
                  <th>DOCUMENTO</th>
                  <th>CLIENTE</th>
                  <th>TIPO</th>
                  <th>TELÉFONO</th>
                  <th>VEHÍCULOS</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>

              <tbody>
                {clientes.map((cliente) => {
                  const activo = Boolean(cliente.activo);

                  return (
                    <tr key={cliente.id}>
                      <td>
                        <strong>{cliente.tipo_documento}</strong>
                        <br />
                        {cliente.numero_documento}
                      </td>

                      <td>
                        <strong>{cliente.nombre_razon_social}</strong>
                        <br />
                        {cliente.correo || "Sin correo"}
                      </td>

                      <td>
                        {cliente.tipo_cliente === "EMPRESA"
                          ? "Empresa"
                          : "Persona"}
                      </td>

                      <td>{cliente.telefono || "—"}</td>

                      <td>{cliente.total_vehiculos ?? 0}</td>

                      <td>
                        <span
                          className={`pill ${
                            activo ? "active-pill" : "neutral"
                          }`}
                        >
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <div className="client-actions">
                          <button
                            type="button"
                            className="text-button"
                            disabled={!esAdministrador}
                            title={esAdministrador ? undefined : "Solo el administrador puede modificar clientes."}
                            onClick={() => editarCliente(cliente)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="text-button"
                            disabled={!esAdministrador}
                            title={esAdministrador ? undefined : "Solo el administrador puede modificar clientes."}
                            onClick={() => cambiarEstado(cliente)}
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

export default Clientes;
