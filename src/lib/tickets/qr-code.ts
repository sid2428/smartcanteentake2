/**
 * Rotating, signed QR codes for canteen tickets.
 *
 * Unlike an OTP (a short shared code the student reads aloud and that stays valid
 * until it times out), each QR is a signed proof bound to ONE ticket (one dish) and
 * ONE 30-second time step:
 *
 *   CQ1.<ticketId>.<step>.<mac>
 *
 *   ticketKey = HMAC-SHA256(serverSecret, "ticket-key:v1:" + ticketId)   (given to the owner's phone)
 *   mac       = HMAC-SHA256(ticketKey, ticketId + ":" + step)[0..16]     (computed on the phone, offline)
 *
 * The server never trusts anything in the QR besides the ticket id: it re-derives the key,
 * checks the MAC and time step, then looks the ticket up and redeems it atomically.
 * A screenshot stops working within ~a minute, and a forged/edited code fails the MAC.
 *
 * Uses WebCrypto only, so this module runs in the browser and on the server.
 */

export const QR_VERSION = "CQ1";
export const STEP_SECONDS = 30;
/** Steps of clock drift accepted on either side of the server's current step. */
export const ALLOWED_DRIFT_STEPS = 1;
const MAC_BYTES = 16;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type VerifyFailure = "MALFORMED" | "BAD_SIGNATURE" | "STALE_CODE";
export type VerifyResult = { ok: true; ticketId: string; step: number } | { ok: false; reason: VerifyFailure };

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(key: Uint8Array<ArrayBuffer>, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return new Uint8Array(signature);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function stepAt(nowMs: number): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** Milliseconds until the code shown at `nowMs` rotates. */
export function msUntilNextStep(nowMs: number): number {
  const stepMs = STEP_SECONDS * 1000;
  return stepMs - (nowMs % stepMs);
}

/** Server side: derive the per-ticket key that is handed to the ticket owner's device. */
export async function deriveTicketKey(serverSecret: string, ticketId: string): Promise<string> {
  const key = await hmac(encoder.encode(serverSecret), `ticket-key:v1:${ticketId}`);
  return toBase64Url(key);
}

async function computeMac(ticketKey: string, ticketId: string, step: number): Promise<string> {
  const mac = await hmac(fromBase64Url(ticketKey), `${ticketId}:${step}`);
  return toBase64Url(mac.slice(0, MAC_BYTES));
}

/** Client side: build the payload to render as a QR for the given moment. */
export async function buildQrPayload(ticketKey: string, ticketId: string, nowMs: number): Promise<string> {
  const step = stepAt(nowMs);
  const mac = await computeMac(ticketKey, ticketId, step);
  return `${QR_VERSION}.${ticketId}.${step}.${mac}`;
}

export function parseQrPayload(payload: string): { ticketId: string; step: number; mac: string } | null {
  const parts = payload.trim().split(".");
  if (parts.length !== 4) return null;
  const [version, ticketId, stepText, mac] = parts;
  if (version !== QR_VERSION || !UUID_RE.test(ticketId) || !/^\d{1,12}$/.test(stepText)) return null;
  if (!/^[A-Za-z0-9_-]{22}$/.test(mac)) return null;
  return { ticketId, step: Number(stepText), mac };
}

/** Server side: check the signature and freshness of a scanned payload. Does NOT touch the database. */
export async function verifyQrPayload(serverSecret: string, payload: string, nowMs: number): Promise<VerifyResult> {
  const parsed = parseQrPayload(payload);
  if (!parsed) return { ok: false, reason: "MALFORMED" };

  const ticketKey = await deriveTicketKey(serverSecret, parsed.ticketId);
  const expected = await computeMac(ticketKey, parsed.ticketId, parsed.step);
  if (!constantTimeEqual(expected, parsed.mac)) return { ok: false, reason: "BAD_SIGNATURE" };

  if (Math.abs(stepAt(nowMs) - parsed.step) > ALLOWED_DRIFT_STEPS) return { ok: false, reason: "STALE_CODE" };

  return { ok: true, ticketId: parsed.ticketId, step: parsed.step };
}
