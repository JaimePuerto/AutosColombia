
export function normalizarPlaca(placa) {
  return String(placa ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

export function validarPlaca(placa, tipo) {
  const normalizada = normalizarPlaca(placa);

  if (tipo === "CARRO") {
    return /^[A-Z]{3}\d{3}$/.test(normalizada);
  }

  if (tipo === "MOTO") {
    return /^[A-Z]{3}\d{2}[A-Z]$/.test(normalizada);
  }

  return false;
}
