// Replica el formato de hash del backend (`scrypt$<salt>$<key>`) para sembrar
// operadores de prueba sin depender de importaciones cruzadas al backend.

import crypto from "node:crypto";

export function generarHashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
