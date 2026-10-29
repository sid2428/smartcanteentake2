import { describe, expect, it } from "vitest";
import {
  ALLOWED_DRIFT_STEPS,
  STEP_SECONDS,
  buildQrPayload,
  deriveTicketKey,
  msUntilNextStep,
  parseQrPayload,
  stepAt,
  verifyQrPayload,
} from "./qr-code";

const SECRET = "test-secret-please-change";
const TICKET = "3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const NOW = Date.UTC(2026, 9, 27, 7, 30, 0);
const STEP_MS = STEP_SECONDS * 1000;

async function payloadAt(nowMs: number, ticketId = TICKET, secret = SECRET) {
  const key = await deriveTicketKey(secret, ticketId);
  return buildQrPayload(key, ticketId, nowMs);
}

describe("QR ticket codes", () => {
  it("round-trips a freshly generated code", async () => {
    const payload = await payloadAt(NOW);
    expect(payload.startsWith("CQ1.")).toBe(true);
    await expect(verifyQrPayload(SECRET, payload, NOW)).resolves.toEqual({
      ok: true,
      ticketId: TICKET,
      step: stepAt(NOW),
    });
  });

  it("rotates the code every step", async () => {
    const a = await payloadAt(NOW);
    const b = await payloadAt(NOW + STEP_MS);
    expect(a).not.toEqual(b);
  });

  it("is deterministic within a step", async () => {
    const start = stepAt(NOW) * STEP_MS;
    expect(await payloadAt(start)).toEqual(await payloadAt(start + STEP_MS - 1));
  });

  it("accepts small clock drift but rejects screenshots older than the drift window", async () => {
    const payload = await payloadAt(NOW);
    const okLater = await verifyQrPayload(SECRET, payload, NOW + ALLOWED_DRIFT_STEPS * STEP_MS);
    expect(okLater.ok).toBe(true);

    const stale = await verifyQrPayload(SECRET, payload, NOW + (ALLOWED_DRIFT_STEPS + 1) * STEP_MS);
    expect(stale).toEqual({ ok: false, reason: "STALE_CODE" });

    const future = await verifyQrPayload(SECRET, payload, NOW - (ALLOWED_DRIFT_STEPS + 1) * STEP_MS);
    expect(future).toEqual({ ok: false, reason: "STALE_CODE" });
  });

  it("rejects a code whose ticket id was swapped", async () => {
    const payload = await payloadAt(NOW);
    const other = "aaaaaaaa-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    const forged = payload.replace(TICKET, other);
    await expect(verifyQrPayload(SECRET, forged, NOW)).resolves.toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a code whose step was edited to look fresh", async () => {
    const old = await payloadAt(NOW - 10 * STEP_MS);
    const parts = old.split(".");
    parts[2] = String(stepAt(NOW));
    await expect(verifyQrPayload(SECRET, parts.join("."), NOW)).resolves.toEqual({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
  });

  it("rejects codes signed with a different server secret", async () => {
    const payload = await payloadAt(NOW, TICKET, "attacker-secret");
    await expect(verifyQrPayload(SECRET, payload, NOW)).resolves.toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("gives different tickets different keys", async () => {
    const other = "bbbbbbbb-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    expect(await deriveTicketKey(SECRET, TICKET)).not.toEqual(await deriveTicketKey(SECRET, other));
  });

  it.each([
    "",
    "hello",
    "123456", // an OTP is not a valid ticket
    `CQ2.${TICKET}.1.AAAAAAAAAAAAAAAAAAAAAA`,
    `CQ1.not-a-uuid.1.AAAAAAAAAAAAAAAAAAAAAA`,
    `CQ1.${TICKET}.-1.AAAAAAAAAAAAAAAAAAAAAA`,
    `CQ1.${TICKET}.1.short`,
    `CQ1.${TICKET}.1.AAAAAAAAAAAAAAAAAAAAAA.extra`,
  ])("rejects malformed payload %j", async (payload) => {
    expect(parseQrPayload(payload)).toBeNull();
    await expect(verifyQrPayload(SECRET, payload, NOW)).resolves.toEqual({ ok: false, reason: "MALFORMED" });
  });

  it("reports time until rotation", () => {
    const start = stepAt(NOW) * STEP_MS;
    expect(msUntilNextStep(start)).toBe(STEP_MS);
    expect(msUntilNextStep(start + 1000)).toBe(STEP_MS - 1000);
  });
});
