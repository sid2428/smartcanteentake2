import { describe, expect, it } from "vitest";
import { estimateReadyTimes, orderStage, prepMinutesFor, type QueueTicket } from "./domain";

const MIN = 60_000;
const NOW = Date.UTC(2026, 9, 30, 7, 0);

function ticket(id: string, over: Partial<QueueTicket> = {}): QueueTicket {
  return {
    id,
    counter: "Main",
    status: "ISSUED",
    qty: 1,
    prepMinutes: 10,
    preparingAt: null,
    slotStartsAt: NOW + 30 * MIN,
    createdAt: NOW - 5 * MIN,
    ...over,
  };
}

describe("prepMinutesFor", () => {
  it("batches extra portions at half cost", () => {
    expect(prepMinutesFor(10, 1)).toBe(10);
    expect(prepMinutesFor(10, 3)).toBe(20);
    expect(prepMinutesFor(3, 2)).toBe(5);
    expect(prepMinutesFor(0, 1)).toBe(1);
  });
});

describe("estimateReadyTimes", () => {
  it("finishes cooking tickets from when they started, but not sooner than a minute away", () => {
    const est = estimateReadyTimes(
      [
        ticket("a", { status: "PREPARING", preparingAt: NOW - 4 * MIN }),
        ticket("b", { status: "PREPARING", preparingAt: NOW - 30 * MIN }),
      ],
      NOW,
    );
    expect(est.get("a")!.readyAt).toBe(NOW + 6 * MIN);
    expect(est.get("b")!.readyAt).toBe(NOW + MIN);
  });

  it("queues waiting tickets behind busy stations, in slot order", () => {
    const est = estimateReadyTimes(
      [
        ticket("cook1", { status: "PREPARING", preparingAt: NOW }),
        ticket("cook2", { status: "PREPARING", preparingAt: NOW - 5 * MIN }),
        ticket("late", { slotStartsAt: NOW + 60 * MIN }),
        ticket("soon", { slotStartsAt: NOW + 15 * MIN }),
      ],
      NOW,
      2,
    );
    // Stations free at +5 and +10. "soon" takes +5 → +15, "late" takes +10 → +20.
    expect(est.get("soon")).toEqual({ readyAt: NOW + 15 * MIN, ahead: 0 });
    expect(est.get("late")).toEqual({ readyAt: NOW + 20 * MIN, ahead: 1 });
  });

  it("keeps counters independent and marks ready tickets as ready now", () => {
    const est = estimateReadyTimes(
      [
        ticket("main", { prepMinutes: 10 }),
        ticket("chai", { counter: "Beverages", prepMinutes: 2 }),
        ticket("done", { status: "READY" }),
      ],
      NOW,
    );
    expect(est.get("main")!.readyAt).toBe(NOW + 10 * MIN);
    expect(est.get("chai")!.readyAt).toBe(NOW + 2 * MIN);
    expect(est.get("done")!.readyAt).toBe(NOW);
  });

  it("grows with workload", () => {
    const light = estimateReadyTimes([ticket("me")], NOW, 1).get("me")!.readyAt;
    const busy = estimateReadyTimes(
      [ticket("x", { createdAt: NOW - 20 * MIN }), ticket("y", { createdAt: NOW - 10 * MIN }), ticket("me")],
      NOW,
      1,
    ).get("me")!.readyAt;
    expect(busy - light).toBe(20 * MIN);
  });
});

describe("orderStage", () => {
  it("follows the slowest dish", () => {
    expect(orderStage("PENDING_PAYMENT", ["ISSUED"])).toBe("PLACED");
    expect(orderStage("PAID", ["ISSUED", "ISSUED"])).toBe("PAID");
    expect(orderStage("PAID", ["PREPARING", "ISSUED"])).toBe("PREPARING");
    expect(orderStage("PAID", ["READY", "REDEEMED"])).toBe("READY");
    expect(orderStage("COMPLETED", ["REDEEMED", "REDEEMED"])).toBe("COLLECTED");
  });

  it("recognises dead ends", () => {
    expect(orderStage("PAYMENT_FAILED", ["CANCELLED"])).toBe("CANCELLED");
    expect(orderStage("CLOSED", ["EXPIRED"])).toBe("EXPIRED");
  });
});
