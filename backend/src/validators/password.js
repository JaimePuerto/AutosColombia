import crypto from 'node:crypto';

// Política de contraseñas (RNF-04).
// El documento académico exige mínimo 8 caracteres con letras y números; el sistema
// mantiene el umbral más estricto de 10 caracteres e incorpora la regla de composición,
// por lo que la política implementada es un superconjunto de la documentada.
export const LONGITUD_MINIMA_PASSWORD = 10;

export function validarPoliticaPassword(password) {
  const valor = typeof password === 'string' ? password : '';

  if (valor.length < LONGITUD_MINIMA_PASSWORD) {
    throw new Error('La contraseña debe tener al menos 10 caracteres.');
  }
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(valor) || !/\d/.test(valor)) {
    throw new Error('La contraseña debe incluir al menos una letra y un número.');
  }
  if (/\s/.test(valor)) {
    throw new Error('La contraseña no debe contener espacios.');
  }
  return true;
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const NUMEROS = '23456789';
const SIMBOLOS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function elegir(conjunto) {
  return conjunto[crypto.randomBytes(1)[0] % conjunto.length];
}

// Genera una contraseña temporal que siempre cumple la política (letras y números).
export function generarPasswordTemporal(longitud = 12) {
  const caracteres = [elegir(LETRAS), elegir(LETRAS), elegir(NUMEROS), elegir(NUMEROS)];
  while (caracteres.length < longitud) caracteres.push(elegir(SIMBOLOS));
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = crypto.randomBytes(1)[0] % (i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
