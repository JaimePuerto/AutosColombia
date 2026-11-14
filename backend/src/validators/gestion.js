function limpiar(valor) {
  return String(valor ?? "").trim();
}

function campoObligatorio(valor, nombre, maximo) {
  const limpio = limpiar(valor);
  if (!limpio) {
    throw Object.assign(new Error(`Debes indicar ${nombre}.`), { status: 400 });
  }
  if (limpio.length > maximo) {
    throw Object.assign(new Error(`${nombre} excede el máximo de ${maximo} caracteres.`), { status: 400 });
  }
  return limpio;
}

function validarCorreo(valor) {
  const correo = campoObligatorio(valor, "el correo electrónico", 150);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw Object.assign(new Error("El correo electrónico no tiene un formato válido."), { status: 400 });
  }
  return correo;
}

export function normalizarAutorizacionDatos(valor) {
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "boolean") return valor;
  if (valor === 1 || valor === 0) return valor === 1;

  if (typeof valor === "string") {
    const normalizado = valor.trim().toLowerCase();
    if (normalizado === "true" || normalizado === "1") return true;
    if (normalizado === "" || normalizado === "false" || normalizado === "0") return false;
  }

  throw Object.assign(
    new Error("La autorización de tratamiento de datos debe ser un valor booleano."),
    { status: 400 },
  );
}

export function validarDatosOperador(datos = {}) {
  return {
    nombre: campoObligatorio(datos.nombre, "los nombres", 100),
    apellidos: campoObligatorio(datos.apellidos, "los apellidos", 100),
    documento: campoObligatorio(datos.documento, "el documento", 30),
    email: validarCorreo(datos.email),
    telefono: campoObligatorio(datos.telefono, "el teléfono", 20),
  };
}

export function validarDatosCliente(datos = {}) {
  const tipoCliente = limpiar(datos.tipo_cliente).toUpperCase();
  if (!["PERSONA", "EMPRESA"].includes(tipoCliente)) {
    throw Object.assign(new Error("El tipo de cliente debe ser PERSONA o EMPRESA."), { status: 400 });
  }

  const nombres = campoObligatorio(datos.nombres, "los nombres", 100);
  const apellidos = campoObligatorio(datos.apellidos, "los apellidos", 100);
  const tipoDocumento = campoObligatorio(datos.tipo_documento, "el tipo de documento", 20).toUpperCase();
  const numeroDocumento = campoObligatorio(datos.numero_documento, "el número de documento", 30);
  const correo = validarCorreo(datos.correo);
  const telefono = campoObligatorio(datos.telefono, "el teléfono", 20);
  const razonSocial = tipoCliente === "EMPRESA"
    ? campoObligatorio(datos.nombre_razon_social, "la razón social", 150)
    : `${nombres} ${apellidos}`;

  return {
    tipo_cliente: tipoCliente,
    tipo_documento: tipoDocumento,
    numero_documento: numeroDocumento,
    nombres,
    apellidos,
    nombre_razon_social: razonSocial,
    telefono,
    correo,
  };
}

export function validarAtributosVehiculo(datos = {}) {
  return {
    marca: campoObligatorio(datos.marca, "la marca del vehículo", 50),
    modelo: campoObligatorio(datos.modelo, "el modelo del vehículo", 50),
    color: campoObligatorio(datos.color, "el color del vehículo", 30),
  };
}
