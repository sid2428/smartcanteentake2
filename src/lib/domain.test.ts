import { describe, expect, it } from "vitest";
import {
  addDays,
  canKitchenMove,
  formatINR,
  generateOrderCode,
  istDate,
  istToUtc,
  kitchenSourcesFor,
  refundAmount,
  refundPercentOnExpiry,
  slotWindowsForDay,
} from "./domain";

describe("IST time helpers", () => {
  it("maps late-evening UTC to the next IST day", () => {
    // 20:00 UTC = 01:30 IST next day
    expect(istDate(Date.UTC(2026, 9, 27, 20, 0))).toBe("2026-10-28");
    expect(istDate(Date.UTC(2026, 9, 27, 10, 0))).toBe("2026-10-27");
  });

  it("converts IST wall-clock time to UTC", () => {
    expect(istToUtc("2026-10-27", "08:00").toISOString()).toBe("2026-10-27T02:30:00.000Z");
    expect(istToUtc("2026-10-27", "13:15:00").toISOString()).toBe("2026-10-27T07:45:00.000Z");
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("slotWindowsForDay", () => {
  it("creates back-to-back slots inside opening hours", () => {
    const slots = slotWindowsForDay("2026-10-27", "12:00", "13:00", 15);
    expect(slots).toHaveLength(4);
    expect(slots[0].startsAt.toISOString()).toBe("2026-10-27T06:30:00.000Z");
    expect(slots[3].endsAt.toISOString()).toBe("2026-10-27T07:30:00.000Z");
  });

  it("drops a trailing partial slot", () => {
    expect(slotWindowsForDay("2026-10-27", "12:00", "12:50", 15)).toHaveLength(3);
  });
});

describe("refund policy", () => {
  it("fully refunds food the canteen never prepared", () => {
    expect(refundPercentOnExpiry("ISSUED", 50)).toBe(100);
    expect(refundPercentOnExpiry("PREPARING", 50)).toBe(100);
  });

  it("applies the no-show percentage to prepared food", () => {
    expect(refundPercentOnExpiry("READY", 50)).toBe(50);
    expect(refundPercentOnExpiry("READY", 0)).toBe(0);
    expect(refundPercentOnExpiry("READY", 150)).toBe(100);
  });

  it("never refunds collected tickets", () => {
    expect(refundPercentOnExpiry("REDEEMED", 100)).toBe(0);
  });

  it("rounds to whole paise", () => {
    expect(refundAmount(4999, 50)).toBe(2500);
  });
});

describe("kitchen transitions", () => {
  it("allows the forward flow and one step back", () => {
    expect(canKitchenMove("ISSUED", "PREPARING")).toBe(true);
    expect(canKitchenMove("PREPARING", "READY")).toBe(true);
    expect(canKitchenMove("READY", "PREPARING")).toBe(true);
  });

  it("never lets the kitchen redeem or revive tickets", () => {
    expect(canKitchenMove("READY", "REDEEMED")).toBe(false);
    expect(canKitchenMove("REDEEMED", "READY")).toBe(false);
    expect(canKitchenMove("EXPIRED", "READY")).toBe(false);
  });

  it("lists valid source statuses", () => {
    expect(kitchenSourcesFor("READY")).toEqual(["ISSUED", "PREPARING"]);
  });
});

describe("misc", () => {
  it("generates readable order codes", () => {
    const code = generateOrderCode();
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{5}$/);
  });

  it("formats rupees", () => {
    expect(formatINR(4000)).toBe("₹40");
    expect(formatINR(4550)).toBe("₹45.50");
  });
});
