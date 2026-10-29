import { describe, expect, it } from "vitest";
import { parseQrPayload } from "@/lib/tickets/qr-code";
import { seedId, slotId } from "./ids";

describe("seed ids", () => {
  it("is stable for the same parts and differs otherwise", () => {
    expect(seedId("ticket", "DEMOA", "Masala Dosa")).toBe(seedId("ticket", "DEMOA", "Masala Dosa"));
    expect(seedId("ticket", "DEMOA", "Masala Dosa")).not.toBe(seedId("ticket", "DEMOB", "Masala Dosa"));
    expect(seedId("ab", "c")).not.toBe(seedId("a", "bc"));
    expect(slotId(new Date("2026-10-29T03:30:00Z"))).toBe(slotId(new Date("2026-10-29T03:30:00.000Z")));
  });

  it("produces ids the QR parser accepts", () => {
    const id = seedId("ticket", "DEMOA", "Filter Coffee");
    expect(parseQrPayload(`CQ1.${id}.123.${"A".repeat(22)}`)?.ticketId).toBe(id);
  });
});
