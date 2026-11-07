import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_SECRET = process.env.KLYRO_SESSION_SECRET || randomBytes(32).toString("hex");
const DEFAULT_DEMO_PASSPHRASE = "klyro-studio";

let generatedPassphrase = null;

export function passphrase() {
  if (process.env.STUDIO_PASSPHRASE) return process.env.STUDIO_PASSPHRASE;
  if (process.env.NODE_ENV === "production") {
    if (!generatedPassphrase) {
      generatedPassphrase = randomBytes(10).toString("base64url");
      console.warn("\n================================================================");
      console.warn("[auth] STUDIO_PASSPHRASE is not set. Generated one-time Studio passphrase:");
      console.warn(`[auth] ${generatedPassphrase}`);
      console.warn("[auth] Set STUDIO_PASSPHRASE in your environment to keep it stable.");
      console.warn("================================================================\n");
    }
    return generatedPassphrase;
  }
  return DEFAULT_DEMO_PASSPHRASE;
}

export function demoMode() {
  return !process.env.STUDIO_PASSPHRASE && process.env.NODE_ENV !== "production";
}

export function createSessionToken() {
  const expires = Date.now() + 7 * 86400000;
  const payload = `${expires}.${randomBytes(8).toString("hex")}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(candidate = "") {
  const parts = String(candidate).split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, sig] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  const expected = createHmac("sha256", SESSION_SECRET).update(`${expires}.${nonce}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function sessionCookie(value, maxAgeSeconds = 7 * 86400) {
  const secure = process.env.KLYRO_SECURE_COOKIES === "true" ? "; Secure" : "";
  return `klyro_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearCookie() {
  return sessionCookie("", 0);
}

export function checkPassphrase(candidate = "") {
  const expected = passphrase();
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
