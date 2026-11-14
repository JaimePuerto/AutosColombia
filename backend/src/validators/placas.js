
export function normalizarPlaca(placa) {
  return String(placa ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

export const TIPOS_VEHICULO = ["CARRO", "MOTO", "CAMIONETA"];

// Las camionetas usan el mismo formato de placa que los carros (RF-01).
export function validarPlaca(placa, tipo) {
  const normalizada = normalizarPlaca(placa);

  if (tipo === "CARRO" || tipo === "CAMIONETA") {
    return /^[A-Z]{3}\d{3}$/.test(normalizada);
  }

  if (tipo === "MOTO") {
    return /^[A-Z]{3}\d{2}[A-Z]$/.test(normalizada);
  }

  return false;
}

// RF-01: las camionetas se almacenan en celdas de tipo CARRO.
export function tipoCeldaParaVehiculo(tipo) {
  const normalizado = String(tipo ?? "").toUpperCase();
  return normalizado === "CAMIONETA" ? "CARRO" : normalizado;
}

// Inverso: dado el tipo de celda, los vehículos compatibles.
export function tiposVehiculoParaCelda(tipoCelda) {
  const normalizado = String(tipoCelda ?? "").toUpperCase();
  return normalizado === "CARRO" ? ["CARRO", "CAMIONETA"] : [normalizado];
}
