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
  stock: z.number().int().min(0).optional(),
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

  if (fields.length === 0) throw new HttpError(400, "No fields to update");

  values.push(id);
  const dish = await queryOne(`UPDATE dishes SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values);
  if (!dish) throw new HttpError(404, "Dish not found");

  return NextResponse.json({ dish });
});

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireRole("owner");
  const { id } = await params;

  const dish = await queryOne("UPDATE dishes SET active = false WHERE id = $1 RETURNING id", [id]);
  if (!dish) throw new HttpError(404, "Dish not found");

  return NextResponse.json({ ok: true });
});
