import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { COUNTERS } from "@/lib/domain";

const UpdateDishSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(50).optional(),
  counter: z.enum(COUNTERS).optional(),
  pricePaise: z.number().int().positive().optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  /** Atomic restock / write-off: added to the live stock, so sales in flight are never overwritten. */
  stockDelta: z.number().int().min(-100_000).max(100_000).optional(),
  /** With `stock`: only apply if stock still equals this (it may have sold since the owner looked). */
  expectedStock: z.number().int().min(0).optional(),
  prepMinutes: z.number().int().min(1).optional(),
  isVeg: z.boolean().optional(),
  emoji: z.string().max(4).optional(),
  active: z.boolean().optional(),
});

export const PATCH = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireRole("owner");
  const { id } = await params;
  const body = await parseBody(request, UpdateDishSchema);

  // Build dynamic SET clause
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const map: Record<string, string> = {
    name: "name",
    description: "description",
    category: "category",
    counter: "counter",
    pricePaise: "price_paise",
    stock: "stock",
    prepMinutes: "prep_minutes",
    isVeg: "is_veg",
    emoji: "emoji",
    active: "active",
  };

  for (const [key, col] of Object.entries(map)) {
    if ((body as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push((body as Record<string, unknown>)[key]);
    }
  }

  if (body.stockDelta !== undefined) {
    if (body.stock !== undefined) throw new HttpError(400, "Send either stock or stockDelta, not both");
    fields.push(`stock = GREATEST(0, stock + $${idx++})`);
    values.push(body.stockDelta);
  }

  if (fields.length === 0) throw new HttpError(400, "No fields to update");

  let guard = "";
  if (body.stock !== undefined && body.expectedStock !== undefined) {
    guard = ` AND stock = $${idx++}`;
    values.push(body.expectedStock);
  }

  values.push(id);
  const dish = await queryOne(`UPDATE dishes SET ${fields.join(", ")} WHERE id = $${idx}${guard} RETURNING *`, values);
  if (!dish) {
    const current = await queryOne<{ stock: number; name: string }>("SELECT stock, name FROM dishes WHERE id = $1", [id]);
    if (!current) throw new HttpError(404, "Dish not found");
    throw new HttpError(
      409,
      `${current.name} sold while you were editing: stock is now ${current.stock}. Check the number and save again.`,
      "STOCK_CHANGED",
    );
  }

  return NextResponse.json({ dish });
});

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireRole("owner");
  const { id } = await params;

  const dish = await queryOne("UPDATE dishes SET active = false WHERE id = $1 RETURNING id", [id]);
  if (!dish) throw new HttpError(404, "Dish not found");

  return NextResponse.json({ ok: true });
});
