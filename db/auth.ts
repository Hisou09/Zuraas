import { database, ensureSchema, isAdminEmail } from "./runtime";

export const AUTH_COOKIE = "zuraas_session";
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 210_000;

export type AuthUser = {
  email: string;
  displayName: string;
  contactEmail: string;
  role: string;
};

function cookieValue(cookieHeader: string | null, name: string) {
  for (const part of (cookieHeader || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, iterations, salt, expected] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !expected) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations: Number(iterations) }, key, 256);
  const actual = new Uint8Array(bits);
  const target = base64ToBytes(expected);
  if (actual.length !== target.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ target[index];
  return difference === 0;
}

export async function authenticateCookie(cookieHeader: string | null): Promise<AuthUser | null> {
  await ensureSchema();
  const token = cookieValue(cookieHeader, AUTH_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const user = await database().prepare("SELECT u.email,u.display_name AS displayName,COALESCE(u.contact_email,u.email) AS contactEmail,u.role FROM auth_sessions s JOIN users u ON u.email=s.user_email WHERE s.token_hash=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP").bind(tokenHash).first<AuthUser>();
  return user || null;
}

export function authenticateRequest(request: Request) {
  return authenticateCookie(request.headers.get("cookie"));
}

export async function ensureUser(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) throw new Error("AUTH_REQUIRED");
  if (isAdminEmail(user.email) && user.role !== "admin") {
    await database().prepare("UPDATE users SET role='admin' WHERE email=?").bind(user.email).run();
    user.role = "admin";
  }
  return user;
}

export async function isAdmin(request: Request) {
  const user = await authenticateRequest(request);
  return Boolean(user && (isAdminEmail(user.email) || user.role === "admin"));
}

export async function createSession(email: string, userAgent = "") {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = await sha256(token);
  await database().prepare("DELETE FROM auth_sessions WHERE datetime(expires_at)<=CURRENT_TIMESTAMP").run();
  await database().prepare("INSERT INTO auth_sessions (token_hash,user_email,expires_at,user_agent) VALUES (?,?,datetime('now',?),?)").bind(tokenHash, email, `+${SESSION_DAYS} days`, userAgent.slice(0, 500)).run();
  return token;
}

export async function deleteSession(cookieHeader: string | null) {
  const token = cookieValue(cookieHeader, AUTH_COOKIE);
  if (token) await database().prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await sha256(token)).run();
}

export function sessionCookie(token: string, secure: boolean) {
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean) {
  return `${AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function newUsercode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(100000 + (value % 900000));
}
