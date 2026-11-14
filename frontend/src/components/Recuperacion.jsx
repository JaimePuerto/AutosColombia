import { useState } from "react";

const API_URL = "http://localhost:3001/api";

// RF-12: recuperación de contraseña por correo.
// Sin token: solicita el enlace. Con token (parámetro ?recuperacion=...): permite
// restablecer la contraseña. El backend no revela si el documento existe.
function Recuperacion({ onVolver }) {
  const tokenUrl = new URLSearchParams(window.location.search).get("recuperacion") || "";
  const [documento, setDocumento] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [enviando, setEnviando] = useState(false);

  async function solicitar(event) {
    event.preventDefault();
    setEnviando(true); setMensaje("");
    try {
      const respuesta = await fetch(`${API_URL}/auth/recuperacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) throw new Error(resultado.mensaje || "No fue posible procesar la solicitud.");
      setMensaje(resultado.mensaje || "Si los datos corresponden a una cuenta activa, enviaremos un enlace de recuperación.");
      setTipoMensaje("success");
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setEnviando(false);
    }
  }

  async function restablecer(event) {
    event.preventDefault();
    setMensaje("");
    if (nueva.length < 10 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva) || /\s/.test(nueva)) {
      setMensaje("La contraseña debe tener mínimo 10 caracteres, con letras y números, sin espacios.");
      setTipoMensaje("error");
      return;
    }
    if (nueva !== confirmacion) {
      setMensaje("La confirmación no coincide con la nueva contraseña.");
      setTipoMensaje("error");
      return;
    }
    setEnviando(true);
    try {
      const respuesta = await fetch(`${API_URL}/auth/recuperacion/restablecer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenUrl, nueva }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) throw new Error(resultado.mensaje || "No fue posible restablecer la contraseña.");
      setMensaje(resultado.mensaje || "Contraseña restablecida correctamente.");
      setTipoMensaje("success");
      setNueva(""); setConfirmacion("");
    } catch (error) {
      setMensaje(error.message);
      setTipoMensaje("error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand-icon auth-brand">A</div>
        <p className="eyebrow">RECUPERACIÓN</p>
        <h1>{tokenUrl ? "Nueva contraseña" : "Recuperar acceso"}</h1>

        {tokenUrl ? (
          <form onSubmit={restablecer}>
            <label className="field"><span>Nueva contraseña</span><input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required /></label>
            <label className="field"><span>Confirmar contraseña</span><input type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" required /></label>
            <small>Mínimo 10 caracteres, con letras y números, sin espacios.</small>
            {mensaje && <div className={`form-message ${tipoMensaje}`} role="alert">{mensaje}</div>}
            <button type="submit" className="primary-button auth-submit" disabled={enviando}>{enviando ? "Guardando..." : "Restablecer contraseña"}</button>
          </form>
        ) : (
          <form onSubmit={solicitar}>
            <p className="page-description">Ingresa tu documento. Si corresponde a una cuenta activa, generaremos un enlace de recuperación.</p>
            <label className="field"><span>Documento</span><input value={documento} onChange={(e) => setDocumento(e.target.value)} required /></label>
            {mensaje && <div className={`form-message ${tipoMensaje}`} role="alert">{mensaje}</div>}
            <button type="submit" className="primary-button auth-submit" disabled={enviando}>{enviando ? "Enviando..." : "Solicitar enlace"}</button>
          </form>
        )}

        <button type="button" className="text-button" onClick={onVolver}>← Volver al inicio de sesión</button>
      </div>
    </div>
  );
}

export default Recuperacion;
