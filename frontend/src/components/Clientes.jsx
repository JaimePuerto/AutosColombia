
import { useEffect, useState } from "react";

const API_URL = "http://localhost:3001/api";
const formularioInicial = {
  tipo_cliente: "PERSONA",
  tipo_documento: "CC",
  numero_documento: "",
  nombre_razon_social: "",
  telefono: "",
  correo: "",
  direccion: "",
};

function Clientes() {
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

  function mostrarMensaje(texto, tipo = "success") {
    setMensaje(texto);
    setTipoMensaje(tipo);
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
        {}
      );

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
    setMostrarFormulario(true);
    setMensaje("");
  }

  function editarCliente(cliente) {
    setFormulario({
      tipo_cliente: cliente.tipo_cliente || "PERSONA",
      tipo_documento: cliente.tipo_documento || "CC",
      numero_documento: cliente.numero_documento || "",
      nombre_razon_social: cliente.nombre_razon_social || "",
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
    setMensaje("");
  }

  async function guardarCliente(event) {
    event.preventDefault();
    setGuardando(true);
    setMensaje("");

    try {
      const esEdicion = Boolean(clienteEditando);

      const respuesta = await fetch(
        esEdicion
          ? `${API_URL}/clientes/${clienteEditando.id}`
          : `${API_URL}/clientes`,
        {
          method: esEdicion ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formulario),
        }
      );

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

      mostrarMensaje(
        esEdicion
          ? "Cliente actualizado correctamente."
          : "Cliente registrado correctamente."
      );

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
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ activo: !activo }),
        }
      );

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

      {mostrarFormulario && (
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

              <label className="field">
                <span>
                  {formulario.tipo_cliente === "EMPRESA"
                    ? "Razón social *"
                    : "Nombre completo *"}
                </span>
                <input
                  name="nombre_razon_social"
                  value={formulario.nombre_razon_social}
                  onChange={actualizarCampo}
                  placeholder={
                    formulario.tipo_cliente === "EMPRESA"
                      ? "Nombre de la empresa"
                      : "Nombre y apellidos"
                  }
                  maxLength={150}
                  required
                />
              </label>

              <label className="field">
                <span>Teléfono</span>
                <input
                  name="telefono"
                  value={formulario.telefono}
                  onChange={actualizarCampo}
                  placeholder="Número de contacto"
                  maxLength={20}
                />
              </label>

              <label className="field">
                <span>Correo electrónico</span>
                <input
                  type="email"
                  name="correo"
                  value={formulario.correo}
                  onChange={actualizarCampo}
                  placeholder="correo@ejemplo.com"
                  maxLength={150}
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
                            onClick={() => editarCliente(cliente)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="text-button"
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
