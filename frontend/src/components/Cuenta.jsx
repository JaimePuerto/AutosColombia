import { useState } from "react";

const API_URL = "http://localhost:3001/api";

// RF-10: cambio de contraseña. Cuando la cuenta tiene una contraseña temporal
// (passwordTemporal), el cambio es obligatorio y no se solicita la contraseña actual.
function Cuenta({ token, usuario, modoForzado = false, onCambiada }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [guardando, setGuardando] = useState(false);

  const exigirActual = !modoForzado && !usuario?.passwordTemporal;

  async function enviar(event) {
    event.preventDefault();
    setMensaje("");

    if (nueva.length < 10) {
      setMensaje("La contraseña debe tener al menos 10 caracteres.");
      setTipoMensaje("error");
      return;
    }
    if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) {
      setMensaje("La contraseña debe incluir letras y números.");
      setTipoMensaje("error");
      return;
    }
    if (/\s/.test(nueva)) {
      setMensaje("La contraseña no puede contener espacios.");
      setTipoMensaje("error");
      return;
    }
    if (nueva !== confirmacion) {
      setMensaje("La confirmación no coincide con la nueva contraseña.");
      setTipoMensaje("error");
      return;
    }

    setGuardando(true);
    try {
      const respuesta = await fetch(`${API_URL}/auth/cambiar-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actual: exigirActual ? actual : undefined, nueva }),
      });
      const resultado = await respuesta.json();
      if (respuesta.status === 401) {
        sessionStorage.removeItem("autoscolombia_token");
        window.location.reload();
        return;
      }
      if (!respuesta.ok || !resultado.ok) throw new Error(resultado.mensaje || "No fue posible cambiar la contraseña.");

      setMensaje("Contraseña actualizada correctamente.");
      setTipoMensaje("success");
      setActual(""); setNueva(""); setConfirmacion("");
      if (onCambiada) onCambiada();
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  }

  const formulario = (
    <form onSubmit={enviar}>
      <div className="form-grid">
        {exigirActual && (
          <label className="field">
            <span>Contraseña actual *</span>
            <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
          </label>
        )}
        <label className="field">
          <span>Nueva contraseña *</span>
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={10} required />
          <small>Mínimo 10 caracteres, con letras y números, sin espacios.</small>
        </label>
        <label className="field">
          <span>Confirmar nueva contraseña *</span>
          <input type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" required />
        </label>
      </div>
      {mensaje && <div className={`form-message ${tipoMensaje}`} role="alert">{mensaje}</div>}
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={guardando}>
          {guardando ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );

  if (modoForzado || usuario?.passwordTemporal) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand-icon auth-brand">A</div>
          <p className="eyebrow">SEGURIDAD</p>
          <h1>Cambio de contraseña obligatorio</h1>
          <p className="page-description">Tu cuenta usa una contraseña temporal. Debes cambiarla para continuar usando el sistema.</p>
          {formulario}
        </div>
      </div>
    );
  }

  return (
    <section className="panel form-panel cuenta-modal-panel">
      <div className="form-section-heading">
        <div>
          <p className="eyebrow">MI CUENTA</p>
          <h3>Cambiar contraseña</h3>
          <p>Usuario: {usuario?.nombre} ({usuario?.rol === "ADMINISTRADOR" ? "Administrador" : "Operador"})</p>
          <p>Actualiza tu contraseña de acceso. Se cerrarán las demás sesiones abiertas por seguridad.</p>
        </div>
      </div>
      {formulario}
    </section>
  );
}

export default Cuenta;
