import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:3001/api";
const OPERADOR_ID = 1;

const menuItems = [
  { id: "dashboard", label: "Panel principal", icon: "▦" },
  { id: "entrada", label: "Ingreso de vehículos", icon: "↘" },
  { id: "salida", label: "Salida de vehículos", icon: "↗" },
  { id: "historial", label: "Historial de movimientos", icon: "◷" },
];

function App() {
  const [seccion, setSeccion] = useState("dashboard");
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
  const [acceso, setAcceso] = useState("PRINCIPAL");
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const seccionActual = menuItems.find((item) => item.id === seccion);

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

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaDashboard, respuestaMovimientos] = await Promise.all([
        fetch(`${API_URL}/dashboard`),
        fetch(`${API_URL}/movimientos`),
      ]);

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
      const movimientosFormateados = filas.flatMap((item) => {
        const entrada = {
          id: `${item.id}-entrada`,
          placa: item.placa,
          tipo: item.tipo,
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
          movimiento: "Salida",
          celda: item.celda,
          hora: formatearFecha(item.fecha_salida),
          operador: item.operador_salida || "No identificado",
          estado: "Finalizado",
          fechaOrden: new Date(item.fecha_salida).getTime(),
        };

        return [salida, entrada];
      });

      movimientosFormateados.sort((a, b) => b.fechaOrden - a.fechaOrden);

      setMovimientos(movimientosFormateados);
    } catch (error) {
      setErrorCarga(
        error.message || "No fue posible conectar con el servidor.",
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function cambiarSeccion(id) {
    setSeccion(id);
    setMensaje("");
  }

  async function registrarMovimiento(event) {
    event.preventDefault();
    setMensaje("");

    const placaNormalizada = placa.replace(/\s/g, "").toUpperCase();
    const esEntrada = seccion === "entrada";

    const esCarro = /^[A-Z]{3}\d{3}$/.test(placaNormalizada);
    const esMoto = /^[A-Z]{3}\d{2}[A-Z]$/.test(placaNormalizada);

    if ((tipo === "CARRO" && !esCarro) || (tipo === "MOTO" && !esMoto)) {
      setMensaje(
        tipo === "CARRO"
          ? "La placa del carro debe tener 3 letras y 3 números."
          : "La placa de la moto debe tener 3 letras, 2 números y una letra final.",
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
            operadorId: OPERADOR_ID,
            acceso,
          }
        : {
            placa: placaNormalizada,
            operadorId: OPERADOR_ID,
            acceso,
          };

      const respuesta = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpo),
      });

      const resultado = await respuesta.json();

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

  const movimientosFiltrados = movimientos.filter((item) => {
    const coincidePlaca = item.placa
      .toLowerCase()
      .includes(busqueda.toLowerCase());

    const coincideEstado =
      filtroEstado === "TODOS" ||
      (filtroEstado === "ACTIVOS" && item.estado === "Activo") ||
      (filtroEstado === "FINALIZADOS" && item.estado === "Finalizado");

    return coincidePlaca && coincideEstado;
  });

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
          {menuItems.map((item) => (
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
          <div className="user-profile">
            <div className="avatar">OP</div>
            <div>
              <strong>Operador</strong>
              <small>Administración</small>
            </div>
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
                          tipo === "CARRO" ? "Ej. ABC123" : "Ej. KLM45D"
                        }
                        maxLength={7}
                        required
                      />
                      <small>
                        Carro: 3 letras y 3 números. Moto: 3 letras, 2 números y
                        una letra.
                      </small>
                    </label>

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
                      </select>
                    </label>

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
                        La validación de horarios se conectará al backend.
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
                          : "Movimientos finalizados"}
                    </h3>
                    <p>{movimientosFiltrados.length} movimientos registrados</p>
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
                    </select>

                    <input
                      className="search-input"
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.target.value)}
                      placeholder="Buscar por placa..."
                    />
                  </div>
                </div>
                <MovimientosTabla movimientos={movimientosFiltrados} />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function MovimientosTabla({ movimientos }) {
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
          </tr>
        </thead>
        <tbody>
          {movimientos.map((item, index) => (
            <tr key={`${item.placa}-${item.movimiento}-${index}`}>
              <td>
                <strong className="plate-value">{item.placa}</strong>
              </td>
              <td>{item.tipo === "CARRO" ? "Carro" : "Moto"}</td>
              <td>
                <span
                  className={`movement-label ${item.movimiento === "Entrada" ? "movement-entry" : "movement-exit"}`}
                >
                  {item.movimiento}
                </span>
              </td>
              <td>{item.celda}</td>
              <td>{item.hora}</td>
              <td>{item.operador || "No identificado"}</td>
              <td>
                <span
                  className={`pill ${item.estado === "Activo" ? "active-pill" : "neutral"}`}
                >
                  {item.estado}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
