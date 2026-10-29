import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/server/http";
import { query, queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { COUNTERS } from "@/lib/domain";

const DishSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  category: z.string().min(1).max(50),
  counter: z.enum(COUNTERS),
  pricePaise: z.number().int().positive(),
  stock: z.number().int().min(0).default(0),
  prepMinutes: z.number().int().min(1).default(5),
  isVeg: z.boolean().default(true),
  emoji: z.string().max(4).default("🍽️"),
  active: z.boolean().default(true),
});

export const GET = handle(async () => {
  await requireRole("owner");
  const rows = await query("SELECT * FROM dishes ORDER BY category, name");
  return NextResponse.json({ dishes: rows });
});

export const POST = handle(async (request: Request) => {
  await requireRole("owner");
  const body = await parseBody(request, DishSchema);

  const dish = await queryOne(
    `INSERT INTO dishes (name, description, category, counter, price_paise, stock, prep_minutes, is_veg, emoji, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [body.name, body.description, body.category, body.counter, body.pricePaise, body.stock, body.prepMinutes, body.isVeg, body.emoji, body.active],
  );

  return NextResponse.json({ dish }, { status: 201 });
});
