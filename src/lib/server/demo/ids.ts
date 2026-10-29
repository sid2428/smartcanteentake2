import { createHash } from "node:crypto";

/**
 * Deterministic UUID from its parts. Seeded rows use these instead of random ids so that
 * every server instance (each holds its own in-memory copy of the demo data) agrees on
 * them: a dish, slot or ticket id from one instance is valid on all the others.
 */
export function seedId(...parts: string[]): string {
  const h = createHash("sha256").update(parts.join("\u0000")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Pickup slots are identified by their start time. */
export function slotId(startsAt: Date): string {
  return seedId("slot", startsAt.toISOString());
}
