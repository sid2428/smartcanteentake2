import "server-only";
import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/lib/domain";
import { getSession } from "./auth";

/**
 * Server-side page guard. The proxy only checks that a session cookie exists; this checks the
 * role, so e.g. a student opening /owner lands on their own home instead of an empty page full
 * of 403s. (APIs enforce roles themselves; this is about a sensible UI.) Owners can use staff pages.
 */
export async function guardPage(path: string, ...roles: Role[]): Promise<void> {
  const session = await getSession();
  if (!session) redirect(`/login?from=${encodeURIComponent(path)}`);
  const allowed = roles.includes(session.role) || (session.role === "owner" && roles.includes("staff"));
  if (!allowed) redirect(ROLE_HOME[session.role]);
}
