// Clave pública para las notificaciones push (la privada vive solo en el
// servidor, en la variable de entorno VAPID_PRIVATE_KEY).
export const VAPID_PUBLIC_KEY =
  'BFiIk1qph3loNPyQWZ_M4nxt8egmsdNGJYtpOJqRLq6-8zqiKxEsEx0iCWncjqmBmzFHFyYuCpFugsviINn6CBA';

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
