import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Role } from "@/lib/domain";
import { env } from "./env";
import { queryOne } from "./db";
import { SESSION_TTL_SECONDS, decodeSession, encodeSession, type SessionPayload } from "./session-token";
import { HttpError } from "./http";

export const SESSION_COOKIE = "cq_session";

/**
 * The signed-in user, or null. The cookie proves identity; role and name are re-read from
 * the database, so a cookie for a user who no longer exists (e.g. a sign-up wiped by a demo
 * reset) simply counts as signed out. Cached per request.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = decodeSession((await cookies()).get(SESSION_COOKIE)?.value, env.sessionSecret);
  if (!token) return null;
  const user = await queryOne<{ id: string; name: string; role: Role }>(
    "SELECT id, name, role FROM users WHERE id = $1",
    [token.uid],
  );
  return user ? { uid: user.id, role: user.role, name: user.name, exp: token.exp } : null;
});

export async function startSession(user: { id: string; role: Role; name: string }): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = encodeSession({ uid: user.id, role: user.role, name: user.name, exp }, env.sessionSecret);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Throws 401/403 unless the caller is signed in with one of the given roles. Owners can act as staff. */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Please sign in");
  const allowed = roles.includes(session.role) || (session.role === "owner" && roles.includes("staff"));
  if (!allowed) throw new HttpError(403, "You don't have access to this");
  return session;
}
