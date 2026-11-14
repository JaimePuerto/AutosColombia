import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal.jsx";

const API_URL = "http://localhost:3001/api";

// RF-35 (anular) y RF-36 (corregir) movimientos. Reutiliza el backend existente
// en /api/movimientos-admin. Solo accesible para administradores.
function MovimientosAdmin({ token, movimiento, accion, onCerrar, onActualizado }) {
  const [celdas, setCeldas] = useState([]);
  const [cargandoCeldas, setCargandoCeldas] = useState(accion === "corregir");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [operacionCompletada, setOperacionCompletada] = useState(false);
  const [correccion, setCorreccion] = useState({
    observaciones: movimiento.observaciones || "",
    acceso_entrada: movimiento.acceso_entrada || "PRINCIPAL",
    acceso_salida: movimiento.acceso_salida || "",
    celda_id: String(movimiento.celda_id || ""),
    motivo: "",
  });

  const headers = useCallback(
    (json = false) => ({
      Authorization: `Bearer ${token}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    }),
    [token],
  );

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
      throw new Error(resultado.mensaje || "No fue posible completar la operación.");
    }
    return resultado;
  };

  useEffect(() => {
    if (accion !== "corregir") return undefined;
    let activo = true;

    async function cargarCeldas() {
      try {
        const respuesta = await fetch(`${API_URL}/celdas`, { headers: headers() });
        const resultado = await manejarRespuesta(respuesta);
        if (activo) setCeldas(resultado.data || []);
      } catch (error) {
        if (activo) {
          setCeldas([]);
          mostrarMensaje(error.message, "error");
        }
      } finally {
        if (activo) setCargandoCeldas(false);
      }
    }

    cargarCeldas();
    return () => { activo = false; };
  }, [accion, headers]);

  const confirmarAnulacion = async (event) => {
    event.preventDefault();
    if (motivoAnulacion.trim().length < 5) {
      mostrarMensaje("El motivo de anulación debe tener al menos 5 caracteres.", "error");
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await fetch(`${API_URL}/movimientos-admin/${movimiento.id}/anular`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ motivo: motivoAnulacion.trim() }),
      });
      await manejarRespuesta(respuesta);
      setOperacionCompletada(true);
      mostrarMensaje("Movimiento anulado correctamente.");
      onActualizado?.();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarCorreccion = async (event) => {
    event.preventDefault();
    if (correccion.motivo.trim().length < 5) {
      mostrarMensaje("El motivo de la corrección debe tener al menos 5 caracteres.", "error");
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        observaciones: correccion.observaciones,
        acceso_entrada: correccion.acceso_entrada,
        motivo: correccion.motivo.trim(),
      };
      if (correccion.acceso_salida) cuerpo.acceso_salida = correccion.acceso_salida;
      if (correccion.celda_id && Number(correccion.celda_id) !== Number(movimiento.celda_id)) {
        cuerpo.celda_id = Number(correccion.celda_id);
      }
      const respuesta = await fetch(`${API_URL}/movimientos-admin/${movimiento.id}/corregir`, {
        method: "PATCH",
        headers: headers(true),
        body: JSON.stringify(cuerpo),
      });
      await manejarRespuesta(respuesta);
      setOperacionCompletada(true);
      mostrarMensaje("Movimiento corregido correctamente.");
      onActualizado?.();
    } catch (error) {
      mostrarMensaje(error.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const opcionesCelda = (movimiento) => {
    const tipoCelda = movimiento.tipo_celda || (movimiento.tipo === "MOTO" ? "MOTO" : "CARRO");
    return celdas.filter((c) => c.tipo === tipoCelda);
  };

  return (
    <Modal
      label={`${accion === "anular" ? "Anular" : "Corregir"} movimiento ${movimiento.id}`}
      onClose={onCerrar}
      message={mensaje}
      messageType={tipoMensaje}
    >
      <section className="panel form-panel">
        <div className="form-section-heading">
          <div>
            <h3>
              {accion === "anular" ? "Anular" : "Corregir"} movimiento #{movimiento.id} — {movimiento.placa}
            </h3>
            <p>
              {accion === "anular"
                ? `Celda ${movimiento.celda}. Si el movimiento está activo, la celda quedará libre. El registro se conserva como anulado.`
                : "No se pueden modificar fechas, vehículo ni operador. La celda de reemplazo debe estar disponible y ser compatible."}
            </p>
          </div>
        </div>

        {operacionCompletada ? (
          <div className="form-actions">
            <button type="button" className="primary-button" onClick={onCerrar}>Cerrar</button>
          </div>
        ) : accion === "anular" ? (
          <form onSubmit={confirmarAnulacion}>
            <label className="field">
              <span>Motivo de anulación *</span>
              <textarea
                value={motivoAnulacion}
                onChange={(event) => setMotivoAnulacion(event.target.value)}
                maxLength={500}
                rows={3}
                required
              />
            </label>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={onCerrar} disabled={guardando}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={guardando || motivoAnulacion.trim().length < 5}>
                {guardando ? "Anulando..." : "Confirmar anulación"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={confirmarCorreccion}>
            <div className="form-grid">
              <label className="field">
                <span>Observaciones</span>
                <textarea
                  value={correccion.observaciones}
                  onChange={(event) => setCorreccion((valor) => ({ ...valor, observaciones: event.target.value }))}
                  maxLength={500}
                  rows={2}
                />
              </label>
              <label className="field">
                <span>Acceso de entrada *</span>
                <select
                  value={correccion.acceso_entrada}
                  onChange={(event) => setCorreccion((valor) => ({ ...valor, acceso_entrada: event.target.value }))}
                >
                  <option value="PRINCIPAL">Acceso principal</option>
                  <option value="SECUNDARIO">Acceso secundario</option>
                </select>
              </label>
              <label className="field">
                <span>Acceso de salida</span>
                <select
                  value={correccion.acceso_salida}
                  onChange={(event) => setCorreccion((valor) => ({ ...valor, acceso_salida: event.target.value }))}
                >
                  <option value="">Sin cambio</option>
                  <option value="PRINCIPAL">Acceso principal</option>
                  <option value="SECUNDARIO">Acceso secundario</option>
                </select>
              </label>
              <label className="field">
                <span>Celda</span>
                <select
                  value={correccion.celda_id}
                  onChange={(event) => setCorreccion((valor) => ({ ...valor, celda_id: event.target.value }))}
                  disabled={cargandoCeldas}
                  required
                >
                  {cargandoCeldas && <option value="">Consultando celdas...</option>}
                  {!cargandoCeldas && opcionesCelda(movimiento).length === 0 && (
                    <option value="">No hay celdas compatibles</option>
                  )}
                  {opcionesCelda(movimiento).map((celda) => (
                    <option key={celda.id} value={celda.id}>{celda.codigo} · {celda.estado}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Motivo de la corrección *</span>
                <input
                  value={correccion.motivo}
                  onChange={(event) => setCorreccion((valor) => ({ ...valor, motivo: event.target.value }))}
                  maxLength={500}
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={onCerrar} disabled={guardando}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={guardando || cargandoCeldas || correccion.motivo.trim().length < 5}>
                {guardando ? "Guardando..." : "Guardar corrección"}
              </button>
            </div>
          </form>
        )}
      </section>
    </Modal>
  );
}

export default MovimientosAdmin;
