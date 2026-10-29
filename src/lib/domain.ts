/**
 * Pure domain rules (no I/O) shared by API routes and UI. Unit tested in domain.test.ts.
 */

export const TICKET_STATUSES = ["ISSUED", "PREPARING", "READY", "REDEEMED", "EXPIRED", "CANCELLED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PAYMENT_FAILED", "COMPLETED", "CLOSED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Role = "student" | "staff" | "owner";

export const COUNTERS = ["Main", "Snacks", "Beverages"] as const;
export type Counter = (typeof COUNTERS)[number];

/** India has no DST, so IST is a fixed +05:30 offset. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const TIME_ZONE = "Asia/Kolkata";

/** Calendar date (YYYY-MM-DD) in IST for an instant. */
export function istDate(nowMs: number): string {
  return new Date(nowMs + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Converts an IST wall-clock time ("HH:MM" or "HH:MM:SS") on a date to a UTC instant. */
export function istToUtc(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  return new Date(utcMidnight + (h * 60 + m) * 60_000 - IST_OFFSET_MS);
}

export type SlotWindow = { startsAt: Date; endsAt: Date };

/** All pickup slots for one IST day between opening and closing time. */
export function slotWindowsForDay(date: string, openTime: string, closeTime: string, slotMinutes: number): SlotWindow[] {
  const open = istToUtc(date, openTime).getTime();
  const close = istToUtc(date, closeTime).getTime();
  const step = slotMinutes * 60_000;
  const slots: SlotWindow[] = [];
  for (let t = open; t + step <= close; t += step) {
    slots.push({ startsAt: new Date(t), endsAt: new Date(t + step) });
  }
  return slots;
}

/**
 * How much of a ticket is refunded when it expires uncollected.
 * - Never prepared (ISSUED / PREPARING): the canteen didn't deliver, so a full refund.
 * - READY but not picked up: food was made, so the owner-configured no-show percentage.
 */
export function refundPercentOnExpiry(status: TicketStatus, noShowRefundPercent: number): number {
  if (status === "ISSUED" || status === "PREPARING") return 100;
  if (status === "READY") return Math.min(100, Math.max(0, noShowRefundPercent));
  return 0;
}

export function refundAmount(amountPaise: number, percent: number): number {
  return Math.round((amountPaise * percent) / 100);
}

/** Kitchen-side transitions. Redemption (READY -> REDEEMED) only happens via a QR scan. */
const KITCHEN_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  ISSUED: ["PREPARING", "READY"],
  PREPARING: ["READY", "ISSUED"],
  READY: ["PREPARING"],
  REDEEMED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canKitchenMove(from: TicketStatus, to: TicketStatus): boolean {
  return KITCHEN_TRANSITIONS[from].includes(to);
}

/** Statuses a kitchen move can start from to reach `to`. */
export function kitchenSourcesFor(to: TicketStatus): TicketStatus[] {
  return TICKET_STATUSES.filter((from) => canKitchenMove(from, to));
}

// Crockford-style alphabet without look-alike characters (0/O, 1/I/L).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Short human-readable order reference shown next to the QR, e.g. "K7Q2M". Not a credential. */
export function generateOrderCode(length = 5): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function formatDay(value: string | Date, nowMs = Date.now()): string {
  const day = istDate(new Date(value).getTime());
  if (day === istDate(nowMs)) return "Today";
  if (day === addDays(istDate(nowMs), 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(
    new Date(value),
  );
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  ISSUED: "Order received",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  REDEEMED: "Collected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
