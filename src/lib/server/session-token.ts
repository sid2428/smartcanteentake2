import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/domain";

export type SessionPayload = { uid: string; role: Role; name: string; exp: number };

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Stateless signed session token: base64url(json).signature */
export function encodeSession(payload: SessionPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function decodeSession(token: string | undefined, secret: string, nowMs = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}
