import test from 'node:test';
import assert from 'node:assert/strict';
import { generarHashPassword, verificarPassword } from '../src/services/auth.service.js';
import { requiereRol } from '../src/middleware/auth.middleware.js';

test('genera hash scrypt y nunca almacena la contraseña en texto plano', () => {
  const password = 'ClaveSegura2026!';
  const hash = generarHashPassword(password);
  assert.match(hash, /^scrypt\$/);
  assert.notEqual(hash, password);
  assert.equal(hash.split('$').length, 3);
  assert.equal(verificarPassword(password, hash), true);
  assert.equal(verificarPassword('OtraClave2026!', hash), false);
});

test('rechaza contraseñas menores a diez caracteres', () => {
  assert.throws(() => generarHashPassword('corta'), /al menos 10 caracteres/);
});

test('permite un rol autorizado', () => {
  const middleware = requiereRol('ADMINISTRADOR', 'OPERADOR');
  const req = { user: { rol: 'OPERADOR' } };
  let nextCalled = false;
  middleware(req, { status() { throw new Error('No debe responder'); }, json() {} }, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('bloquea roles que no tienen autorización', () => {
  const middleware = requiereRol('ADMINISTRADOR');
  const req = { user: { rol: 'OPERADOR' } };
  let statusCode;
  let payload;
  middleware(req, { status(code) { statusCode = code; return this; }, json(data) { payload = data; } }, () => assert.fail('No debe continuar'));
  assert.equal(statusCode, 403);
  assert.equal(payload.ok, false);
});
