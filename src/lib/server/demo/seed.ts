import "server-only";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { addDays, istDate, slotWindowsForDay, type TicketStatus } from "@/lib/domain";
import { hashPassword } from "../passwords";
import { seedId, slotId } from "./ids";
import { SCHEMA_SQL } from "./schema";
import { seedHistory } from "./history";

type DishSeed = {
  name: string; description: string; category: string; counter: "Main" | "Snacks" | "Beverages";
  rupees: number; stock: number; prep: number; veg: boolean; emoji: string;
};

const DISHES: DishSeed[] = [
  { name: "Masala Dosa", description: "Crispy dosa with potato masala, sambar & chutney", category: "South Indian", counter: "Main", rupees: 60, stock: 40, prep: 8, veg: true, emoji: "🫓" },
  { name: "Idli Sambar", description: "3 soft idlis with sambar and coconut chutney", category: "South Indian", counter: "Main", rupees: 45, stock: 50, prep: 4, veg: true, emoji: "🍚" },
  { name: "Veg Thali", description: "2 rotis, dal, sabzi, rice, salad & sweet", category: "Thali", counter: "Main", rupees: 110, stock: 30, prep: 10, veg: true, emoji: "🍽️" },
  { name: "Paneer Butter Masala", description: "With 2 butter naans", category: "North Indian", counter: "Main", rupees: 130, stock: 25, prep: 12, veg: true, emoji: "🍛" },
  { name: "Chicken Biryani", description: "Hyderabadi dum biryani with raita", category: "North Indian", counter: "Main", rupees: 150, stock: 20, prep: 10, veg: false, emoji: "🍗" },
  { name: "Veg Hakka Noodles", description: "Wok-tossed noodles with vegetables", category: "Chinese", counter: "Main", rupees: 80, stock: 30, prep: 8, veg: true, emoji: "🍜" },
  { name: "Samosa (2 pcs)", description: "With green and tamarind chutney", category: "Snacks", counter: "Snacks", rupees: 30, stock: 60, prep: 2, veg: true, emoji: "🥟" },
  { name: "Vada Pav", description: "Mumbai-style, with fried chilli", category: "Snacks", counter: "Snacks", rupees: 25, stock: 60, prep: 2, veg: true, emoji: "🍔" },
  { name: "Gulab Jamun (2 pcs)", description: "Warm, in sugar syrup", category: "Desserts", counter: "Snacks", rupees: 40, stock: 40, prep: 1, veg: true, emoji: "🍮" },
  { name: "Filter Coffee", description: "South Indian decoction coffee", category: "Beverages", counter: "Beverages", rupees: 25, stock: 100, prep: 2, veg: true, emoji: "☕" },
  { name: "Masala Chai", description: "Ginger and cardamom tea", category: "Beverages", counter: "Beverages", rupees: 15, stock: 100, prep: 2, veg: true, emoji: "🍵" },
  { name: "Mango Lassi", description: "Thick sweet lassi with Alphonso mango", category: "Beverages", counter: "Beverages", rupees: 50, stock: 40, prep: 2, veg: true, emoji: "🥭" },
];

const HOUR = 60 * 60_000;
/** Seeded live orders stay usable this long, so the demo cases don't expire mid-presentation. */
const DEMO_VALIDITY_MS = 12 * HOUR;

type DishRow = { id: string; name: string; counter: string; price_paise: number };
type Line = { dish: string; qty: number; ticket: TicketStatus };

/** Creates a fresh in-memory database filled with demo data. */
export async function createDemoDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SCHEMA_SQL);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.transaction((tx) => seed(tx, passwordHash, Date.now()));
  return db;
}

async function seed(tx: Transaction, passwordHash: string, now: number): Promise<void> {
  // Open 07:00–23:00 IST so there are pickup slots at most times of day.
  await tx.query("UPDATE settings SET open_time = '07:00', close_time = '23:00' WHERE id = 1");

  for (const a of DEMO_ACCOUNTS) {
    await tx.query(
      "INSERT INTO users (id, name, email, college_id, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)",
      [a.id, a.name, a.email, a.role === "student" ? "CS-2024-042" : null, a.role, passwordHash],
    );
  }
  const [student, staff] = DEMO_ACCOUNTS;

  const dishes = new Map<string, DishRow>();
  for (const d of DISHES) {
    const { rows } = await tx.query<DishRow>(
      `INSERT INTO dishes (id, name, description, category, counter, price_paise, stock, prep_minutes, is_veg, emoji)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, counter, price_paise`,
      [seedId("dish", d.name), d.name, d.description, d.category, d.counter, d.rupees * 100, d.stock, d.prep, d.veg, d.emoji],
    );
    dishes.set(d.name, rows[0]);
  }

  // Pickup slots for today and tomorrow, plus one earlier today for the history orders.
  const today = istDate(now);
  for (const date of [today, addDays(today, 1)]) {
    for (const w of slotWindowsForDay(date, "07:00", "23:00", 15)) {
      await tx.query("INSERT INTO pickup_slots (id, starts_at, ends_at, capacity) VALUES ($1, $2, $3, 25)", [
        slotId(w.startsAt),
        w.startsAt.toISOString(),
        w.endsAt.toISOString(),
      ]);
    }
  }
  const upcoming = await tx.query<{ id: string }>(
    "SELECT id FROM pickup_slots WHERE starts_at >= $1 ORDER BY starts_at LIMIT 3",
    [new Date(now + 15 * 60_000).toISOString()],
  );
  const pastStart = new Date(Math.floor((now - 2 * HOUR) / (15 * 60_000)) * 15 * 60_000);
  const past = await tx.query<{ id: string }>(
    `INSERT INTO pickup_slots (id, starts_at, ends_at, capacity) VALUES ($1, $2, $3, 25)
     ON CONFLICT (starts_at) DO UPDATE SET capacity = pickup_slots.capacity RETURNING id`,
    [slotId(pastStart), pastStart.toISOString(), new Date(pastStart.getTime() + 15 * 60_000).toISOString()],
  );
  const slotIds = upcoming.rows.map((r) => r.id);
  const pastSlotId = past.rows[0].id;

  async function order(o: {
    code: string; slotId: string; status: string; lines: Line[];
    createdAt: number; paid: boolean; holdUntil: number; ticketsExpire: number;
  }): Promise<string[]> {
    const total = o.lines.reduce((s, l) => s + dishes.get(l.dish)!.price_paise * l.qty, 0);
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO orders (id, code, user_id, slot_id, total_paise, status, payment_method, payment_ref, hold_expires_at, paid_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        seedId("order", o.code), o.code, student.id, o.slotId, total, o.status,
        o.paid ? "UPI_MOCK" : null, o.paid ? `PAY_${o.code}` : null,
        new Date(o.holdUntil).toISOString(), o.paid ? new Date(o.createdAt + 60_000).toISOString() : null,
        new Date(o.createdAt).toISOString(),
      ],
    );
    const orderId = rows[0].id;
    await tx.query("UPDATE pickup_slots SET booked = booked + 1 WHERE id = $1", [o.slotId]);

    const ticketIds: string[] = [];
    for (const l of o.lines) {
      const dish = dishes.get(l.dish)!;
      await tx.query("INSERT INTO order_items (id, order_id, dish_id, qty, unit_paise) VALUES ($1, $2, $3, $4, $5)", [
        seedId("item", o.code, l.dish), orderId, dish.id, l.qty, dish.price_paise,
      ]);
      await tx.query("UPDATE dishes SET stock = stock - $1 WHERE id = $2", [l.qty, dish.id]);
      const at = (status: TicketStatus[]) => (status.includes(l.ticket) ? new Date(o.createdAt + 5 * 60_000).toISOString() : null);
      const t = await tx.query<{ id: string }>(
        `INSERT INTO tickets (id, order_id, user_id, dish_id, dish_name, counter, qty, amount_paise, status, expires_at,
                              preparing_at, ready_at, redeemed_at, redeemed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [
          seedId("ticket", o.code, l.dish), orderId, student.id, dish.id, dish.name, dish.counter, l.qty, dish.price_paise * l.qty, l.ticket,
          new Date(o.ticketsExpire).toISOString(),
          at(["PREPARING", "READY", "REDEEMED", "EXPIRED"]), at(["READY", "REDEEMED", "EXPIRED"]),
          l.ticket === "REDEEMED" ? new Date(o.createdAt + 30 * 60_000).toISOString() : null,
          l.ticket === "REDEEMED" ? staff.id : null,
          new Date(o.createdAt).toISOString(),
        ],
      );
      ticketIds.push(t.rows[0].id);
    }
    return ticketIds;
  }

  const live = { createdAt: now - 10 * 60_000, holdUntil: now + DEMO_VALIDITY_MS, ticketsExpire: now + DEMO_VALIDITY_MS };

  // Case 1: paid, food READY. Log in as student → Tickets to show the QR, then scan it as staff.
  await order({ code: "DEMOA", slotId: slotIds[0], status: "PAID", paid: true, ...live, lines: [
    { dish: "Masala Dosa", qty: 1, ticket: "READY" },
    { dish: "Filter Coffee", qty: 1, ticket: "READY" },
  ] });

  // Case 2: paid, still in the kitchen. Move it along on the staff Kitchen board.
  await order({ code: "DEMOB", slotId: slotIds[1] ?? slotIds[0], status: "PAID", paid: true, ...live, lines: [
    { dish: "Veg Thali", qty: 1, ticket: "PREPARING" },
    { dish: "Samosa (2 pcs)", qty: 2, ticket: "ISSUED" },
  ] });

  // Case 3: placed but not paid yet. Open it from Orders and press Pay (or Cancel).
  await order({ code: "DEMOC", slotId: slotIds[2] ?? slotIds[0], status: "PENDING_PAYMENT", paid: false, ...live, lines: [
    { dish: "Paneer Butter Masala", qty: 1, ticket: "ISSUED" },
  ] });

  // History, so the owner dashboard and refunds page aren't empty.
  const history = { slotId: pastSlotId, paid: true, createdAt: now - 3 * HOUR, holdUntil: now - 3 * HOUR, ticketsExpire: now - HOUR };
  const served = await order({ code: "DEMOD", status: "COMPLETED", ...history, lines: [
    { dish: "Veg Hakka Noodles", qty: 1, ticket: "REDEEMED" },
    { dish: "Masala Chai", qty: 2, ticket: "REDEEMED" },
  ] });
  for (const id of served) {
    await tx.query("INSERT INTO ticket_events (ticket_id, event, actor_id) VALUES ($1, 'REDEEMED_SCAN', $2)", [id, staff.id]);
  }

  const [noShow] = await order({ code: "DEMOE", status: "CLOSED", ...history, lines: [
    { dish: "Vada Pav", qty: 2, ticket: "EXPIRED" },
  ] });
  const vadaPav = dishes.get("Vada Pav")!.price_paise * 2;
  await tx.query(
    "INSERT INTO refunds (ticket_id, user_id, amount_paise, percent, reason) VALUES ($1, $2, $3, 50, $4)",
    [noShow, student.id, vadaPav / 2, "Automatic refund: ticket uncollected (READY)"],
  );

  // Four weeks of other students' orders, for the owner's demand prediction.
  await seedHistory(tx, dishes, passwordHash, staff.id, now);
}
