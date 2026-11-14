import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal.jsx";

const API_URL = "http://localhost:3001/api";

const formularioInicial = {
  nombre: "",
  apellidos: "",
  documento: "",
  email: "",
  telefono: "",
  rol: "OPERADOR",
  password: "",
};

// RF-16 a RF-21 y RF-13: gestión de usuarios (operadores).
function Operadores({ token }) {
  const [operadores, setOperadores] = useState([]);
  const [filtros, setFiltros] = useState({ documento: "", nombre: "", estado: "TODOS" });
  const [formulario, setFormulario] = useState(formularioInicial);
  const [operadorEditando, setOperadorEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [cambioEstado, setCambioEstado] = useState(null);
  const [estadoDestino, setEstadoDestino] = useState("SUSPENDIDO");
  const [motivo, setMotivo] = useState("");

  const headers = useCallback(
    (json = false) => ({
      Authorization: `Bearer ${token}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    }),
    [token],
  );

  function mostrarMensaje(texto, tipo = "success") {
    setMensaje(texto);
    setTipoMensaje(tipo);
  }

  async function manejarRespuesta(respuesta) {
    if (respuesta.status === 401) {
      sessionStorage.removeItem("autoscolombia_token");
      window.location.reload();
      throw new Error("La sesión expiró. Inicia sesión nuevamente.");
    }
    const resultado = await respuesta.json();
    if (!respuesta.ok || !resultado.ok) {
      throw new Error(resultado.mensaje || "No fue posible completar la operación.");
    }
    return resultado;
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const parametros = new URLSearchParams();
      if (filtros.documento.trim()) parametros.set("documento", filtros.documento.trim());
      if (filtros.nombre.trim()) parametros.set("nombre", filtros.nombre.trim());
      if (filtros.estado !== "TODOS") parametros.set("estado", filtros.estado);

      const respuesta = await fetch(`${API_URL}/operadores?${parametros.toString()}`, { headers: headers() });
      const resultado = await manejarRespuesta(respuesta);
      setOperadores(resultado.data || []);
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setCargando(false);
    }
  }, [filtros, headers]);

  useEffect(() => { cargar(); }, [cargar]);

  function nuevoOperador() {
    setFormulario(formularioInicial);
    setOperadorEditando(null);
    setMostrarFormulario(true);
    setMensaje("");
  }

  function editarOperador(operador) {
    setFormulario({
      nombre: operador.nombre || "",
      apellidos: operador.apellidos || "",
      documento: operador.documento || "",
      email: operador.email || "",
      telefono: operador.telefono || "",
      rol: operador.rol || "OPERADOR",
      password: "",
    });
    setOperadorEditando(operador);
    setMostrarFormulario(true);
    setMensaje("");
  }

  function cancelarFormulario() {
    setMostrarFormulario(false);
    setOperadorEditando(null);
    setFormulario(formularioInicial);
    setMensaje("");
  }

  async function guardar(event) {
    event.preventDefault();
    setGuardando(true);
    setMensaje("");

    try {
      const esEdicion = Boolean(operadorEditando);
      const cuerpo = { ...formulario };
      if (esEdicion) delete cuerpo.password;

      const respuesta = await fetch(
        esEdicion ? `${API_URL}/operadores/${operadorEditando.id}` : `${API_URL}/operadores`,
        {
          method: esEdicion ? "PUT" : "POST",
          headers: headers(true),
          body: JSON.stringify(cuerpo),
        },
      );

      const resultado = await manejarRespuesta(respuesta);

      setMostrarFormulario(false);
      setOperadorEditando(null);
      setFormulario(formularioInicial);

      // RF-16: cuando el backend genera una contraseña temporal, se muestra una sola vez.
      if (!esEdicion && resultado.data?.passwordTemporalEmitida) {
        mostrarMensaje(`Operador creado. Contraseña temporal: ${resultado.data.passwordTemporalEmitida}`);
      } else {
        mostrarMensaje(esEdicion ? "Operador actualizado correctamente." : "Operador creado correctamente.");
      }

      await cargar();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  }

  function abrirCambioEstado(operador) {
    setCambioEstado(operador);
    setEstadoDestino(operador.estado === "ACTIVO" ? "SUSPENDIDO" : "ACTIVO");
    setMotivo("");
    setMensaje("");
  }

  async function confirmarCambioEstado(event) {
    event.preventDefault();
    if (motivo.trim().length < 5) {
      mostrarMensaje("El motivo debe tener al menos 5 caracteres.", "error");
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await fetch(`${API_URL}/operadores/${cambioEstado.id}/estado`, {
        method: "PATCH",
        headers: headers(true),
        body: JSON.stringify({ estado: estadoDestino, motivo: motivo.trim() }),
      });
      const resultado = await manejarRespuesta(respuesta);

      if (resultado.data?.passwordTemporalEmitida) {
        mostrarMensaje(`Estado actualizado. Contraseña temporal: ${resultado.data.passwordTemporalEmitida}`);
      } else {
        mostrarMensaje("Estado del operador actualizado.");
      }

      setCambioEstado(null);
      await cargar();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  }

  async function desbloquear(operador) {
    if (!window.confirm(`¿Desbloquear la cuenta de ${operador.nombre}? Se generará una contraseña temporal.`)) return;
    try {
      const respuesta = await fetch(`${API_URL}/operadores/${operador.id}/desbloquear`, {
        method: "POST",
        headers: headers(),
      });
      const resultado = await manejarRespuesta(respuesta);
      mostrarMensaje(
        resultado.data?.passwordTemporalEmitida
          ? `Cuenta desbloqueada. Contraseña temporal: ${resultado.data.passwordTemporalEmitida}`
          : "Cuenta desbloqueada.",
      );
      await cargar();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    }
  }

  const puedeCambiarEstado = (operador) => operador.estado !== "DESVINCULADO";

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h2>Gestión de usuarios</h2>
          <p className="page-description">Crea operadores y administra sus perfiles, estados y accesos.</p>
        </div>
        <button className="primary-button" onClick={nuevoOperador}>+ Nuevo usuario</button>
      </div>

      {mensaje && <div className={`form-message ${tipoMensaje}`} role="alert">{mensaje}</div>}

      {mostrarFormulario && (
        <Modal label={operadorEditando ? "Editar usuario" : "Registrar usuario"} onClose={cancelarFormulario} message={tipoMensaje === "error" ? mensaje : ""}>
        <section className="panel form-panel">
          <div className="form-section-heading">
            <span className="form-heading-icon">♧</span>
            <div>
              <h3>{operadorEditando ? "Editar usuario" : "Registrar usuario"}</h3>
              <p>Las credenciales serán utilizadas para iniciar sesión.</p>
            </div>
          </div>

          <form onSubmit={guardar}>
            <div className="form-grid">
              <label className="field"><span>Nombres *</span><input value={formulario.nombre} onChange={(e) => setFormulario((v) => ({ ...v, nombre: e.target.value }))} required maxLength={100} /></label>
              <label className="field"><span>Apellidos *</span><input value={formulario.apellidos} onChange={(e) => setFormulario((v) => ({ ...v, apellidos: e.target.value }))} required maxLength={100} /></label>
              <label className="field"><span>Documento *</span><input value={formulario.documento} onChange={(e) => setFormulario((v) => ({ ...v, documento: e.target.value }))} required maxLength={30} /></label>
              <label className="field"><span>Correo electrónico *</span><input type="email" value={formulario.email} onChange={(e) => setFormulario((v) => ({ ...v, email: e.target.value }))} required maxLength={150} /></label>
              <label className="field"><span>Teléfono *</span><input value={formulario.telefono} onChange={(e) => setFormulario((v) => ({ ...v, telefono: e.target.value }))} required maxLength={20} /></label>
              <label className="field">
                <span>Perfil *</span>
                <select value={formulario.rol} onChange={(e) => setFormulario((v) => ({ ...v, rol: e.target.value }))}>
                  <option value="OPERADOR">Operador</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                </select>
              </label>

              {!operadorEditando && (
                <label className="field">
                  <span>Contraseña inicial</span>
                  <input type="password" value={formulario.password} onChange={(e) => setFormulario((v) => ({ ...v, password: e.target.value }))} minLength={10} autoComplete="new-password" />
                  <small>Opcional. Si se deja vacía, se genera una contraseña temporal de cambio obligatorio.</small>
                </label>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={cancelarFormulario} disabled={guardando}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={guardando}>
                {guardando ? "Guardando..." : operadorEditando ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </form>
        </section>
        </Modal>
      )}

      {cambioEstado && (
        <Modal label={`Cambiar estado de ${cambioEstado.nombre}`} onClose={() => setCambioEstado(null)} message={tipoMensaje === "error" ? mensaje : ""}>
        <section className="panel form-panel">
          <div className="form-section-heading">
            <div>
              <h3>Cambiar estado de {cambioEstado.nombre}</h3>
              <p>Estado actual: {cambioEstado.estado}. El motivo es obligatorio y quedará auditado.</p>
            </div>
          </div>
          <form onSubmit={confirmarCambioEstado}>
            <div className="form-grid">
              <label className="field">
                <span>Nuevo estado *</span>
                <select value={estadoDestino} onChange={(e) => setEstadoDestino(e.target.value)}>
                  <option value="ACTIVO">Activo</option>
                  <option value="SUSPENDIDO">Suspendido</option>
                  <option value="DESVINCULADO">Desvinculado</option>
                </select>
              </label>
              <label className="field">
                <span>Motivo *</span>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} required />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setCambioEstado(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={guardando || motivo.trim().length < 5}>
                {guardando ? "Guardando..." : "Confirmar cambio"}
              </button>
            </div>
          </form>
        </section>
        </Modal>
      )}

      <section className="panel recent-panel history-panel">
        <div className="history-toolbar">
          <div>
            <h3>Usuarios registrados</h3>
            <p>{operadores.length} usuarios encontrados</p>
          </div>
          <div className="history-filters">
            <input className="search-input" value={filtros.documento} onChange={(e) => setFiltros((v) => ({ ...v, documento: e.target.value }))} placeholder="Documento..." />
            <input className="search-input" value={filtros.nombre} onChange={(e) => setFiltros((v) => ({ ...v, nombre: e.target.value }))} placeholder="Nombre..." />
            <select className="search-input" value={filtros.estado} onChange={(e) => setFiltros((v) => ({ ...v, estado: e.target.value }))}>
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="SUSPENDIDO">Suspendidos</option>
              <option value="DESVINCULADO">Desvinculados</option>
            </select>
          </div>
        </div>

        {cargando ? (
          <p className="empty-state">Consultando usuarios...</p>
        ) : operadores.length === 0 ? (
          <p className="empty-state">No hay usuarios que coincidan con los filtros.</p>
        ) : (
          <div className="table-wrapper">
            <table className="movement-table">
              <thead>
                <tr><th>NOMBRE</th><th>DOCUMENTO</th><th>PERFIL</th><th>CONTACTO</th><th>ESTADO</th><th>ACCIONES</th></tr>
              </thead>
              <tbody>
                {operadores.map((operador) => (
                  <tr key={operador.id}>
                    <td><strong>{operador.nombre} {operador.apellidos || ""}</strong></td>
                    <td>{operador.documento}</td>
                    <td>{operador.rol === "ADMINISTRADOR" ? "Administrador" : "Operador"}</td>
                    <td>{operador.email || operador.telefono || "—"}</td>
                    <td>
                      <span className={`pill ${operador.bloqueado ? "cancelled-pill" : operador.estado === "ACTIVO" ? "active-pill" : "neutral"}`}>
                        {operador.bloqueado ? "Bloqueado" : operador.estado}
                      </span>
                    </td>
                    <td>
                      <div className="client-actions">
                        <button type="button" className="text-button" onClick={() => editarOperador(operador)}>Editar</button>
                        {puedeCambiarEstado(operador) && (
                          <button type="button" className="text-button" onClick={() => abrirCambioEstado(operador)}>Estado</button>
                        )}
                        {Number(operador.bloqueado) === 1 && (
                          <button type="button" className="text-button" onClick={() => desbloquear(operador)}>Desbloquear</button>
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
    </>
  );
}

export default Operadores;
