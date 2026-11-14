import { useEffect, useRef, useState } from "react";
import "./App.css";
import Clientes from "./components/Clientes";
import Vehiculos from "./components/Vehiculos";
import Auditoria from "./components/Auditoria";
import Celdas from "./components/Celdas";
import Suscripciones from "./components/Suscripciones";
import MovimientosAdmin from "./components/MovimientosAdmin";
import Cuenta from "./components/Cuenta";
import Recuperacion from "./components/Recuperacion";
import Operadores from "./components/Operadores";
import Modal from "./components/Modal";

const API_URL = "http://localhost:3001/api";

const menuItems = [
  { id: "dashboard", label: "Panel principal", icon: "▦" },
  { id: "entrada", label: "Ingreso de vehículos", icon: "↘" },
  { id: "salida", label: "Salida de vehículos", icon: "↗" },
  { id: "historial", label: "Historial de movimientos", icon: "◷" },
  { id: "clientes", label: "Gestión de clientes", icon: "♙" },
  { id: "vehiculos", label: "Gestión de vehículos", icon: "▤", admin: true },
  { id: "operadores", label: "Gestión de usuarios", icon: "♧", admin: true },
  { id: "auditoria", label: "Auditoría", icon: "◷", admin: true },
  { id: "celdas", label: "Gestión de celdas", icon: "▦", admin: true },
  { id: "suscripciones", label: "Suscripciones", icon: "▣", admin: true },
];

function formatearFecha(fecha) {
  if (!fecha) return "";

  return new Date(fecha).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Convierte los movimientos del backend en filas de entrada, salida o anulación.
function formatearMovimientos(filas) {
  const resultado = filas.flatMap((item) => {
    if (item.anulado_en) {
      return [
        {
          id: `${item.id}-anulado`,
          placa: item.placa,
          tipo: item.tipo,
          registroOriginal: item,
          movimiento: "Anulación",
          celda: item.celda,
          hora: formatearFecha(item.anulado_en),
          operador:
            item.operador_salida || item.operador_entrada || "No identificado",
          detalle: item.motivo_anulacion || "",
          estado: "Anulado",
          fechaOrden: new Date(item.anulado_en).getTime(),
        },
      ];
    }

    const entrada = {
      id: `${item.id}-entrada`,
      placa: item.placa,
      tipo: item.tipo,
      registroOriginal: item,
      movimiento: "Entrada",
      celda: item.celda,
      hora: formatearFecha(item.fecha_entrada),
      operador: item.operador_entrada || "No identificado",
      estado: item.fecha_salida ? "Finalizado" : "Activo",
      fechaOrden: new Date(item.fecha_entrada).getTime(),
    };

    if (!item.fecha_salida) {
      return [entrada];
    }

    const salida = {
      id: `${item.id}-salida`,
      placa: item.placa,
      tipo: item.tipo,
      registroOriginal: item,
      movimiento: "Salida",
      celda: item.celda,
      hora: formatearFecha(item.fecha_salida),
      operador: item.operador_salida || "No identificado",
      estado: "Finalizado",
      fechaOrden: new Date(item.fecha_salida).getTime(),
    };

    return [salida, entrada];
  });

  resultado.sort((a, b) => b.fechaOrden - a.fechaOrden);

  return resultado;
}

function App() {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem("autoscolombia_token") || "");
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [seccion, setSeccion] = useState("dashboard");
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [mostrarCuenta, setMostrarCuenta] = useState(false);
  const [accionMovimiento, setAccionMovimiento] = useState(null);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null);
  const menuUsuarioRef = useRef(null);
  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState("CARRO");
  const [mensaje, setMensaje] = useState("");
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState({
    total_celdas: 0,
    celdas_carros: 0,
    celdas_motos: 0,
    vehiculos_dentro: 0,
    carros_dentro: 0,
    motos_dentro: 0,
    celdas_libres: 0,
  });
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [historial, setHistorial] = useState([]);
  const [versionHistorial, setVersionHistorial] = useState(0);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState("");
  const [acceso, setAcceso] = useState("PRINCIPAL");
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  // RF-12: pantalla de recuperación de contraseña desde el inicio de sesión.
  const [mostrarRecuperacion, setMostrarRecuperacion] = useState(
    () => new URLSearchParams(window.location.search).has("recuperacion"),
  );

  const menuVisible = menuItems.filter((item) => !item.admin || usuario?.rol === "ADMINISTRADOR");
  const seccionActual = menuVisible.find((item) => item.id === seccion);

  useEffect(() => {
    if (!menuUsuarioAbierto) return undefined;

    function cerrarAlHacerClickFuera(event) {
      if (!menuUsuarioRef.current?.contains(event.target)) setMenuUsuarioAbierto(false);
    }

    function cerrarConEscape(event) {
      if (event.key === "Escape") setMenuUsuarioAbierto(false);
    }

    document.addEventListener("pointerdown", cerrarAlHacerClickFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("pointerdown", cerrarAlHacerClickFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [menuUsuarioAbierto]);

  function encabezadosAuth(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    };
  }

  useEffect(() => {
    let activo = true;
    async function validarSesion() {
      if (!token) { setCargandoAuth(false); return; }
      try {
        const respuesta = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.ok) throw new Error("Sesión vencida");
        if (activo) setUsuario(resultado.data);
      } catch {
        sessionStorage.removeItem("autoscolombia_token");
        if (activo) { setToken(""); setUsuario(null); }
      } finally { if (activo) setCargandoAuth(false); }
    }
    validarSesion();
    return () => { activo = false; };
  }, [token]);

  async function iniciarSesion(event) {
    event.preventDefault();
    const formulario = new FormData(event.currentTarget);
    setErrorCarga("");
    try {
      const respuesta = await fetch(`${API_URL}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento: formulario.get("documento"), password: formulario.get("password") }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.ok) throw new Error(resultado.mensaje || "No fue posible iniciar sesión.");
      sessionStorage.setItem("autoscolombia_token", resultado.data.token);
      setToken(resultado.data.token);
      setUsuario(resultado.data.usuario);
      setSeccion("dashboard");
    } catch (error) { setErrorCarga(error.message); }
  }

  async function cerrarSesion() {
    try { await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: encabezadosAuth() }); } catch { /* se limpia localmente */ }
    sessionStorage.removeItem("autoscolombia_token");
    setToken(""); setUsuario(null); setSeccion("dashboard");
  }

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaDashboard, respuestaMovimientos] = await Promise.all([
        fetch(`${API_URL}/dashboard`, { headers: encabezadosAuth() }),
        fetch(`${API_URL}/movimientos`, { headers: encabezadosAuth() }),
      ]);

      if (respuestaDashboard.status === 401 || respuestaMovimientos.status === 401) {
        await cerrarSesion();
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }
      if (!respuestaDashboard.ok || !respuestaMovimientos.ok) {
        throw new Error("No fue posible consultar los datos del parqueadero.");
      }

      const [resultadoDashboard, resultadoMovimientos] = await Promise.all([
        respuestaDashboard.json(),
        respuestaMovimientos.json(),
      ]);

      if (!resultadoDashboard.ok || !resultadoMovimientos.ok) {
        throw new Error("La API no pudo devolver todos los datos solicitados.");
      }

      setResumen(resultadoDashboard.data);

      const filas = resultadoMovimientos.data || [];
      setTotalMovimientos(filas.length);
      setMovimientos(formatearMovimientos(filas));
    } catch (error) {
      setErrorCarga(
        error.message || "No fue posible conectar con el servidor.",
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (usuario && !usuario.passwordTemporal) cargarDatos();
  }, [usuario]);

  // Consulta el historial con los filtros aplicados en el backend (con retardo para el buscador).
  useEffect(() => {
    if (!usuario || seccion !== "historial") return undefined;

    const parametros = new URLSearchParams();
    if (filtroEstado !== "TODOS") parametros.set("estado", filtroEstado);
    if (busqueda.trim()) parametros.set("placa", busqueda.trim());
    parametros.set("limite", "300");

    let activo = true;
    const temporizador = setTimeout(async () => {
      setCargandoHistorial(true);
      setErrorHistorial("");

      try {
        const respuesta = await fetch(`${API_URL}/movimientos?${parametros.toString()}`, {
          headers: encabezadosAuth(),
        });

        if (respuesta.status === 401) {
          await cerrarSesion();
          throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
        }

        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.ok) {
          throw new Error(resultado.mensaje || "No fue posible consultar el historial.");
        }

        if (activo) setHistorial(formatearMovimientos(resultado.data || []));
      } catch (error) {
        if (activo) {
          setHistorial([]);
          setErrorHistorial(error.message || "No fue posible consultar el historial.");
        }
      } finally {
        if (activo) setCargandoHistorial(false);
      }
    }, 300);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [usuario, seccion, filtroEstado, busqueda, versionHistorial]);

  function cambiarSeccion(id) {
    setSeccion(id);
    setMenuUsuarioAbierto(false);
    setMensaje("");
  }

  function abrirAccionMovimiento(accion, movimiento) {
    setMovimientoSeleccionado(movimiento);
    setAccionMovimiento(accion);
  }

  function cerrarAccionMovimiento() {
    setAccionMovimiento(null);
    setMovimientoSeleccionado(null);
  }

  async function registrarMovimiento(event) {
    event.preventDefault();
    setMensaje("");

    const placaNormalizada = placa.replace(/\s/g, "").toUpperCase();
    const esEntrada = seccion === "entrada";

    const esCarro = /^[A-Z]{3}\d{3}$/.test(placaNormalizada);
    const esMoto = /^[A-Z]{3}\d{2}[A-Z]$/.test(placaNormalizada);

    // En la salida el tipo ya está registrado en el sistema, por lo que sólo se valida
    // que la placa corresponda a un formato admitido (carro/camioneta o moto).
    if (!esEntrada) {
      if (!esCarro && !esMoto) {
        setMensaje(
          "La placa debe tener 3 letras y 3 números (carro o camioneta) o 3 letras, 2 números y una letra final (moto).",
        );
        return;
      }
    } else if (
      // RF-01: las camionetas usan el mismo formato de placa que los carros.
      ((tipo === "CARRO" || tipo === "CAMIONETA") && !esCarro) ||
      (tipo === "MOTO" && !esMoto)
    ) {
      setMensaje(
        tipo === "MOTO"
          ? "La placa de la moto debe tener 3 letras, 2 números y una letra final."
          : "La placa del carro o camioneta debe tener 3 letras y 3 números.",
      );
      return;
    }

    try {
      const endpoint = esEntrada
        ? `${API_URL}/movimientos/entrada`
        : `${API_URL}/movimientos/salida`;

      const cuerpo = esEntrada
        ? {
            placa: placaNormalizada,
            tipo,
            acceso,
          }
        : {
            placa: placaNormalizada,
            acceso,
          };

      const respuesta = await fetch(endpoint, {
        method: "POST",
        headers: encabezadosAuth(true),
        body: JSON.stringify(cuerpo),
      });

      const resultado = await respuesta.json();
      if (respuesta.status === 401) {
        await cerrarSesion();
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      if (!respuesta.ok || !resultado.ok) {
        throw new Error(
          resultado.message ||
            resultado.error ||
            "No fue posible completar la operación.",
        );
      }

      const data = resultado.data;

      await cargarDatos();

      setMensaje(
        data.mensaje ||
          (esEntrada
            ? "Ingreso registrado correctamente."
            : "Salida registrada correctamente."),
      );

      setPlaca("");
    } catch (error) {
      setMensaje(error.message || "No fue posible conectar con el servidor.");
    }
  }

  if (cargandoAuth) return <div className="auth-screen"><div className="auth-card"><h2>AutosColombia</h2><p>Verificando sesión...</p></div></div>;

  // RF-12: recuperación de contraseña por correo (pantalla previa al inicio de sesión).
  if (mostrarRecuperacion) {
    return (
      <Recuperacion
        onVolver={() => {
          setMostrarRecuperacion(false);
          window.history.replaceState({}, "", window.location.pathname);
        }}
      />
    );
  }

  if (!usuario) return <Login onSubmit={iniciarSesion} error={errorCarga} onRecuperar={() => setMostrarRecuperacion(true)} />;

  // RF-10: si la cuenta usa una contraseña temporal, el cambio es obligatorio.
  if (usuario.passwordTemporal) {
    return (
      <Cuenta
        token={token}
        usuario={usuario}
        modoForzado
        onCambiada={async () => {
          try {
            const respuesta = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
            const resultado = await respuesta.json();
            if (respuesta.ok && resultado.ok) setUsuario(resultado.data);
          } catch { /* el middleware ya no bloqueará tras el cambio */ }
        }}
      />
    );
  }

  const movimientosFiltrados = historial;

  const totalCeldas = Number(resumen.total_celdas || 0);
  const celdasCarros = Number(resumen.celdas_carros || 0);
  const celdasMotos = Number(resumen.celdas_motos || 0);
  const vehiculosActivos = Number(resumen.vehiculos_dentro || 0);
  const carrosActivos = Number(resumen.carros_dentro || 0);
  const motosActivas = Number(resumen.motos_dentro || 0);
  const celdasLibres = Number(resumen.celdas_libres || 0);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <h1>AutosColombia</h1>
            <span>Gestión de parqueadero</span>
          </div>
        </div>

        <div className="menu-label">MENÚ PRINCIPAL</div>

        <nav className="navigation">
          {menuVisible.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${seccion === item.id ? "active" : ""}`}
              onClick={() => cambiarSeccion(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="status-indicator">
            <span className="status-dot" />
            <div>
              <strong>Sistema conectado</strong>
              <small>Gestión de parqueadero</small>
            </div>
          </div>

          <div className="developer-credits">
            <strong>Desarrollado por:</strong>
            <span>Estefanya Romero</span>
            <span>Manuel Pemberthy</span>
            <span>Jaime Puerto</span>
          </div>

          <p>AutosColombia · Versión 1.0</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>AutosColombia</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{seccionActual?.label}</strong>
          </div>
          <div className="user-profile" ref={menuUsuarioRef}>
            <button
              type="button"
              className="user-menu-trigger"
              aria-haspopup="menu"
              aria-expanded={menuUsuarioAbierto}
              onClick={() => setMenuUsuarioAbierto((abierto) => !abierto)}
            >
              <span className="avatar">{usuario.nombre?.slice(0, 2).toUpperCase()}</span>
              <span className="user-menu-info">
                <strong>{usuario.nombre}</strong>
                <small>{usuario.rol === "ADMINISTRADOR" ? "Administrador" : "Operador"}</small>
              </span>
              <span className={`user-menu-chevron ${menuUsuarioAbierto ? "open" : ""}`} aria-hidden="true">⌄</span>
            </button>

            {menuUsuarioAbierto && (
              <div className="user-dropdown" role="menu">
                <button
                  type="button"
                  className="user-dropdown-option"
                  role="menuitem"
                  onClick={() => {
                    setMenuUsuarioAbierto(false);
                    setMostrarCuenta(true);
                  }}
                >
                  <span className="user-dropdown-icon">⚙</span>
                  <span>
                    <strong>Mi cuenta</strong>
                    <small>Cambiar contraseña</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="user-dropdown-option logout-option"
                  role="menuitem"
                  onClick={cerrarSesion}
                >
                  <span className="user-dropdown-icon">↪</span>
                  <span>
                    <strong>Cerrar sesión</strong>
                    <small>Salir de AutosColombia</small>
                  </span>
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="page-content">
          {errorCarga && (
            <div className="form-message error" role="alert">
              {errorCarga}
              <button
                type="button"
                className="text-button"
                onClick={cargarDatos}
              >
                Reintentar
              </button>
            </div>
          )}
          {seccion === "dashboard" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">RESUMEN GENERAL</p>
                  <h2>Panel principal</h2>
                  <p className="page-description">
                    Consulta el estado y la actividad del parqueadero.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => cambiarSeccion("entrada")}
                >
                  <span>＋</span> Registrar ingreso
                </button>
              </div>

              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Capacidad total</span>
                    <span className="stat-icon blue">▦</span>
                  </div>
                  <strong className="stat-number">{totalCeldas}</strong>
                  <p>
                    {celdasCarros} carros · {celdasMotos} motos
                  </p>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">
                      Vehículos en el parqueadero
                    </span>
                    <span className="stat-icon green">↙</span>
                  </div>
                  <strong className="stat-number">{vehiculosActivos}</strong>
                  <p>Vehículos con entrada registrada y sin salida</p>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Celdas disponibles</span>
                    <span className="stat-icon orange">✓</span>
                  </div>
                  <strong className="stat-number">{celdasLibres}</strong>
                  <p>Celdas habilitadas que no están ocupadas</p>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Movimientos registrados</span>
                    <span className="stat-icon purple">◷</span>
                  </div>

                  <strong className="stat-number">{totalMovimientos}</strong>

                  <p>Registros de estacionamiento consultados</p>
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="panel occupancy-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Ocupación del parqueadero</h3>
                      <p>Distribución general de las celdas</p>
                    </div>
                    <span className="pill neutral">{totalCeldas} celdas</span>
                  </div>

                  <div className="occupancy-summary">
                    <div>
                      <span className="legend-dot occupied" />
                      <span>Ocupadas</span>
                      <strong>{vehiculosActivos}</strong>
                    </div>
                    <div>
                      <span className="legend-dot available" />
                      <span>Disponibles</span>
                      <strong>{celdasLibres}</strong>
                    </div>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          totalCeldas > 0
                            ? Math.min(
                                100,
                                (vehiculosActivos / totalCeldas) * 100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="occupancy-types">
                    <div className="type-card">
                      <div className="type-title">
                        <span>Carros</span>
                        <strong>{celdasCarros}</strong>
                      </div>

                      <p>
                        {carrosActivos} de {celdasCarros} celdas ocupadas
                      </p>

                      <div className="mini-track">
                        <div
                          style={{
                            width: `${
                              celdasCarros > 0
                                ? Math.min(
                                    100,
                                    (carrosActivos / celdasCarros) * 100,
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="type-card">
                      <div className="type-title">
                        <span>Motos</span>
                        <strong>{celdasMotos}</strong>
                      </div>

                      <p>
                        {motosActivas} de {celdasMotos} celdas ocupadas
                      </p>

                      <div className="mini-track moto-track">
                        <div
                          style={{
                            width: `${
                              celdasMotos > 0
                                ? Math.min(
                                    100,
                                    (motosActivas / celdasMotos) * 100,
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </article>

                <article className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Accesos rápidos</h3>
                      <p>Operaciones frecuentes</p>
                    </div>
                  </div>

                  <button
                    className="quick-action"
                    onClick={() => cambiarSeccion("entrada")}
                  >
                    <span className="quick-icon entry-icon">↘</span>
                    <span>
                      <strong>Ingreso de vehículos</strong>
                      <small>Registrar un nuevo ingreso</small>
                    </span>
                    <span className="quick-arrow">→</span>
                  </button>
                  <button
                    className="quick-action"
                    onClick={() => cambiarSeccion("salida")}
                  >
                    <span className="quick-icon exit-icon">↗</span>
                    <span>
                      <strong>Salida de vehículos</strong>
                      <small>Registrar la salida de un vehículo</small>
                    </span>
                    <span className="quick-arrow">→</span>
                  </button>
                  <button
                    className="quick-action"
                    onClick={() => cambiarSeccion("historial")}
                  >
                    <span className="quick-icon history-icon">◷</span>
                    <span>
                      <strong>Historial de movimientos</strong>
                      <small>Consultar registros</small>
                    </span>
                    <span className="quick-arrow">→</span>
                  </button>
                </article>
              </section>

              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Movimientos recientes</h3>
                    <p>Últimos movimientos registrados</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => cambiarSeccion("historial")}
                  >
                    Ver historial →
                  </button>
                </div>
                {cargando ? (
                  <p className="empty-state">Consultando movimientos...</p>
                ) : (
                  <MovimientosTabla movimientos={movimientos.slice(0, 4)} />
                )}
              </section>
            </>
          )}

          {(seccion === "entrada" || seccion === "salida") && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">CONTROL VEHICULAR</p>
                  <h2>
                    {seccion === "entrada"
                      ? "Ingreso de vehículos"
                      : "Salida de vehículos"}
                  </h2>
                  <p className="page-description">
                    {seccion === "entrada"
                      ? "Registra la entrada de un vehículo al parqueadero."
                      : "Busca el vehículo y registra su salida del parqueadero."}
                  </p>
                </div>
              </div>

              <section className="panel form-panel">
                <div className="form-section-heading">
                  <span className="form-heading-icon">
                    {seccion === "entrada" ? "↘" : "↗"}
                  </span>
                  <div>
                    <h3>Información del vehículo</h3>
                    <p>Los campos marcados son necesarios para continuar.</p>
                  </div>
                </div>

                <form onSubmit={registrarMovimiento}>
                  <div className="form-grid">
                    <label className="field">
                      <span>
                        Placa del vehículo <b>*</b>
                      </span>
                      <input
                        value={placa}
                        onChange={(event) =>
                          setPlaca(event.target.value.toUpperCase())
                        }
                        placeholder={
                          seccion === "entrada" && tipo === "MOTO"
                            ? "Ej. KLM45D"
                            : "Ej. ABC123"
                        }
                        maxLength={7}
                        required
                      />
                      <small>
                        Carro y camioneta: 3 letras y 3 números. Moto: 3 letras, 2
                        números y una letra.
                      </small>
                    </label>

                    {seccion === "entrada" && (
                      <label className="field">
                        <span>
                          Tipo de vehículo <b>*</b>
                        </span>
                        <select
                          value={tipo}
                          onChange={(event) => setTipo(event.target.value)}
                        >
                          <option value="CARRO">Carro</option>
                          <option value="MOTO">Moto</option>
                          <option value="CAMIONETA">Camioneta</option>
                        </select>
                      </label>
                    )}

                    <label className="field">
                      <span>Acceso</span>
                      <select
                        value={acceso}
                        onChange={(event) => setAcceso(event.target.value)}
                      >
                        <option value="PRINCIPAL">Acceso principal</option>
                        <option value="SECUNDARIO">Acceso secundario</option>
                      </select>
                      <small>
                        Acceso por el que el vehículo ingresa o sale del parqueadero.
                      </small>
                    </label>
                  </div>

                  {mensaje && (
                    <div
                      className={`form-message ${
                        /correctamente|celda asignada/i.test(mensaje) &&
                        !/ya está parqueado|no fue posible|error|no hay celdas/i.test(
                          mensaje,
                        )
                          ? "success"
                          : "error"
                      }`}
                      role="alert"
                    >
                      {mensaje}
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setPlaca("");
                        setMensaje("");
                      }}
                    >
                      Limpiar
                    </button>
                    <button type="submit" className="primary-button">
                      {seccion === "entrada"
                        ? "Registrar ingreso"
                        : "Registrar salida"}
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}

          {seccion === "historial" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">CONSULTAS</p>
                  <h2>Historial de movimientos</h2>
                  <p className="page-description">
                    Consulta los ingresos y salidas registrados.
                  </p>
                </div>
              </div>

              <section className="panel recent-panel history-panel">
                <div className="history-toolbar">
                  <div>
                    <h3>
                      {filtroEstado === "TODOS"
                        ? "Todos los movimientos"
                        : filtroEstado === "ACTIVOS"
                          ? "Movimientos activos"
                          : filtroEstado === "ANULADOS"
                            ? "Movimientos anulados"
                            : "Movimientos finalizados"}
                    </h3>
                    <p>
                      {cargandoHistorial
                        ? "Consultando movimientos..."
                        : `${movimientosFiltrados.length} movimientos registrados`}
                    </p>
                  </div>

                  <div className="history-filters">
                    <select
                      className="search-input"
                      value={filtroEstado}
                      onChange={(event) => setFiltroEstado(event.target.value)}
                    >
                      <option value="TODOS">Todos los movimientos</option>
                      <option value="ACTIVOS">Activos</option>
                      <option value="FINALIZADOS">Finalizados</option>
                      <option value="ANULADOS">Anulados</option>
                    </select>

                    <input
                      className="search-input"
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.target.value)}
                      placeholder="Buscar por placa..."
                    />
                  </div>
                </div>

                {errorHistorial && <p className="form-message error">{errorHistorial}</p>}

                <MovimientosTabla
                  movimientos={movimientosFiltrados}
                  esAdministrador={usuario.rol === "ADMINISTRADOR"}
                  onAccionAdmin={abrirAccionMovimiento}
                />
              </section>
            </>
          )}

          {seccion === "clientes" && <Clientes rol={usuario.rol} />}
          {seccion === "vehiculos" && usuario.rol === "ADMINISTRADOR" && <Vehiculos token={token} />}
          {seccion === "operadores" && usuario.rol === "ADMINISTRADOR" && <Operadores token={token} />}
          {seccion === "auditoria" && usuario.rol === "ADMINISTRADOR" && <Auditoria />}
          {seccion === "celdas" && usuario.rol === "ADMINISTRADOR" && <Celdas token={token} />}
          {seccion === "suscripciones" && usuario.rol === "ADMINISTRADOR" && <Suscripciones token={token} />}
        </div>
      </main>

      {usuario.rol === "ADMINISTRADOR" && accionMovimiento && movimientoSeleccionado && (
        <MovimientosAdmin
          key={`${accionMovimiento}-${movimientoSeleccionado.id}`}
          token={token}
          movimiento={movimientoSeleccionado}
          accion={accionMovimiento}
          onCerrar={cerrarAccionMovimiento}
          onActualizado={() => setVersionHistorial((version) => version + 1)}
        />
      )}

      {mostrarCuenta && (
        <Modal label="Mi cuenta" onClose={() => setMostrarCuenta(false)}>
          <Cuenta token={token} usuario={usuario} />
        </Modal>
      )}
    </div>
  );
}

function Login({ onSubmit, error, onRecuperar }) {
  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand-icon auth-brand">A</div>
        <p className="eyebrow">SISTEMA DE CONTROL</p>
        <h1>AutosColombia</h1>
        <p className="page-description">Ingresa con tus credenciales para continuar.</p>
        <label className="field"><span>Documento</span><input name="documento" autoComplete="username" required placeholder="Número de documento" /></label>
        <label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" required placeholder="Tu contraseña" /></label>
        {error && <div className="form-message error" role="alert">{error}</div>}
        <button className="primary-button auth-submit" type="submit">Iniciar sesión</button>
        {onRecuperar && (
          <button type="button" className="text-button" onClick={onRecuperar}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </form>
    </div>
  );
}

function MovimientosTabla({ movimientos, esAdministrador = false, onAccionAdmin }) {
  if (movimientos.length === 0) {
    return (
      <p className="empty-state">
        No hay movimientos que coincidan con la búsqueda.
      </p>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="movement-table">
        <thead>
          <tr>
            <th>PLACA</th>
            <th>TIPO</th>
            <th>MOVIMIENTO</th>
            <th>CELDA</th>
            <th>HORA</th>
            <th>OPERADOR</th>
            <th>ESTADO</th>
            {esAdministrador && <th>ACCIONES</th>}
          </tr>
        </thead>
        <tbody>
          {movimientos.map((item, index) => {
            const registro = item.registroOriginal;
            const anulado = Boolean(registro?.anulado_en);
            const activo = Boolean(registro && !registro.fecha_salida && !anulado);

            return (
            <tr key={`${item.placa}-${item.movimiento}-${index}`}>
              <td>
                <strong className="plate-value">{item.placa}</strong>
              </td>
              <td>{item.tipo === "CARRO" ? "Carro" : item.tipo === "CAMIONETA" ? "Camioneta" : "Moto"}</td>
              <td>
                <span
                  className={`movement-label ${
                    item.movimiento === "Entrada"
                      ? "movement-entry"
                      : item.movimiento === "Salida"
                        ? "movement-exit"
                        : "movement-cancelled"
                  }`}
                  title={item.detalle || undefined}
                >
                  {item.movimiento}
                </span>
              </td>
              <td>{item.celda}</td>
              <td>{item.hora}</td>
              <td>{item.operador || "No identificado"}</td>
              <td>
                <span
                  className={`pill ${
                    item.estado === "Activo"
                      ? "active-pill"
                      : item.estado === "Anulado"
                        ? "cancelled-pill"
                        : "neutral"
                  }`}
                >
                  {item.estado}
                </span>
              </td>
              {esAdministrador && (
                <td>
                  {(item.movimiento === "Entrada" || item.movimiento === "Anulación") && (
                    <div className="movement-row-actions">
                      <button
                        type="button"
                        className="text-button"
                        disabled={anulado}
                        title={anulado ? "El movimiento ya está anulado" : "Anular este movimiento"}
                        onClick={() => onAccionAdmin("anular", registro)}
                      >
                        Anular
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={!activo}
                        title={activo ? "Corregir este movimiento activo" : "Solo se pueden corregir movimientos activos"}
                        onClick={() => onAccionAdmin("corregir", registro)}
                      >
                        Corregir
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;

