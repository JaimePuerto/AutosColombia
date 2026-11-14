import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function Modal({ label, onClose, message = "", messageType = "error", children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <button className="modal-close" type="button" aria-label="Cerrar ventana" onClick={onClose}>
          &times;
        </button>
        {message && <div className={`form-message ${messageType}`} role="alert">{message}</div>}
        {children}
      </section>
    </div>,
    document.body,
  );
}

export default Modal;
