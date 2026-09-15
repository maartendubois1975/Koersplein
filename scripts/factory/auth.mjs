import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const encode = (value) => Buffer.from(value).toString('base64url');
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

export function authConfigured() {
  return Boolean(process.env.KOERSPLEIN_ADMIN_USERNAME && process.env.KOERSPLEIN_ADMIN_PASSWORD && (process.env.KOERSPLEIN_SESSION_SECRET || '').length >= 32);
}

export function validCredentials(username, password) {
  const expectedUser = Buffer.from(process.env.KOERSPLEIN_ADMIN_USERNAME || '');
  const expectedPassword = Buffer.from(process.env.KOERSPLEIN_ADMIN_PASSWORD || '');
  const actualUser = Buffer.from(username || '');
  const actualPassword = Buffer.from(password || '');
  return actualUser.length === expectedUser.length && actualPassword.length === expectedPassword.length &&
    timingSafeEqual(actualUser, expectedUser) && timingSafeEqual(actualPassword, expectedPassword);
}

export function createSession(username) {
  const payload = encode(JSON.stringify({ username, csrf: randomBytes(24).toString('base64url'), expires: Date.now() + 8 * 60 * 60 * 1000 }));
  return `${payload}.${sign(payload, process.env.KOERSPLEIN_SESSION_SECRET)}`;
}

export function readSession(cookie = '') {
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('kp_admin='))?.slice(9);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload || '', process.env.KOERSPLEIN_SESSION_SECRET || '');
  if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.expires > Date.now() ? session : null;
  } catch { return null; }
}

export const sessionCookie = (token, secure = false) => `kp_admin=${token}; HttpOnly; SameSite=Strict; Path=/beheer; Max-Age=28800${secure ? '; Secure' : ''}`;
export const clearSessionCookie = (secure = false) => `kp_admin=; HttpOnly; SameSite=Strict; Path=/beheer; Max-Age=0${secure ? '; Secure' : ''}`;
