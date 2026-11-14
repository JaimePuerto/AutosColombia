import dotenv from 'dotenv';

dotenv.config();

// Proveedor de correo configurable (RF-12).
// Modos soportados:
//   - 'consola' (por defecto): no envía correos reales, solo registra el enlace en consola.
//   - 'http': realiza una petición POST al endpoint configurado en MAIL_API_URL con la
//     cabecera Authorization: Bearer <MAIL_API_KEY>. Permite conectar cualquier servicio
//     transaccional (SMTP-to-HTTP, Resend, SendGrid, etc.) sin acoplar el código.
//
// Variables de entorno:
//   MAIL_PROVIDER=consola|http
//   MAIL_FROM=Sistema AutosColombia <no-reply@autoscolombia.local>
//   MAIL_API_URL=https://proveedor.example.com/enviar
//   MAIL_API_KEY=...
//   APP_BASE_URL=http://localhost:5173   (usada para construir el enlace de recuperación)
const PROVEEDOR = (process.env.MAIL_PROVIDER || 'consola').toLowerCase();
const REMITENTE = process.env.MAIL_FROM || 'Sistema AutosColombia <no-reply@autoscolombia.local>';
const APP_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

export function proveedorCorreoConfigurado() {
  if (PROVEEDOR === 'consola') return false;
  if (PROVEEDOR === 'http') return Boolean(process.env.MAIL_API_URL);
  return false;
}

export function construirEnlaceRecuperacion(token) {
  const base = APP_URL.replace(/\/+$/, '');
  return `${base}/?recuperacion=${encodeURIComponent(token)}`;
}

// Envía el correo de recuperación. Si no hay proveedor real configurado, no simula el envío:
// devuelve enviado=false y deja el enlace disponible para la consola del servidor.
export async function enviarCorreoRecuperacion({ destinatario, nombre, enlace }) {
  const asunto = 'Recuperación de contraseña - AutosColombia';
  const cuerpo = [
    `Hola ${nombre || ''},`.trim(),
    '',
    'Recibimos una solicitud para restablecer tu contraseña en AutosColombia.',
    `Abre el siguiente enlace para definir una nueva contraseña (válido por 30 minutos):`,
    enlace,
    '',
    'Si no solicitaste este cambio, ignora este mensaje.',
  ].join('\n');

  if (!proveedorCorreoConfigurado()) {
    console.log(`[correo:simulado] Para: ${destinatario || '(sin correo)'} | Enlace: ${enlace}`);
    return { enviado: false, proveedor: 'consola' };
  }

  const respuesta = await fetch(process.env.MAIL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.MAIL_API_KEY ? { Authorization: `Bearer ${process.env.MAIL_API_KEY}` } : {}),
    },
    body: JSON.stringify({ from: REMITENTE, to: destinatario, subject: asunto, text: cuerpo }),
  });

  if (!respuesta.ok) {
    throw new Error(`El proveedor de correo respondió con estado ${respuesta.status}.`);
  }
  return { enviado: true, proveedor: 'http' };
}
