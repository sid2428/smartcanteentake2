import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, type SessionPayload } from "./session-token";
import { hashPassword, verifyPassword } from "./passwords";

const SECRET = "session-secret";
const payload: SessionPayload = { uid: "u1", role: "student", name: "Asha", exp: 2_000_000_000 };

describe("session tokens", () => {
  it("round-trips", () => {
    expect(decodeSession(encodeSession(payload, SECRET), SECRET, 0)).toEqual(payload);
  });

  it("rejects a tampered role", () => {
    const token = encodeSession(payload, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, role: "owner" })).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`, SECRET, 0)).toBeNull();
  });

  it("rejects expired and foreign tokens", () => {
    const token = encodeSession(payload, SECRET);
    expect(decodeSession(token, SECRET, (payload.exp + 1) * 1000)).toBeNull();
    expect(decodeSession(token, "other", 0)).toBeNull();
    expect(decodeSession("garbage", SECRET, 0)).toBeNull();
    expect(decodeSession(undefined, SECRET, 0)).toBeNull();
  });
});

describe("passwords", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("canteen123");
    expect(await verifyPassword("canteen123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("canteen123", "not-a-hash")).toBe(false);
  });
});
