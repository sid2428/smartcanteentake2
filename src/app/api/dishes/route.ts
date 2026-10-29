import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query } from "@/lib/server/db";
import { getSession } from "@/lib/server/auth";
import { maybeSweep } from "@/lib/server/sweeps";

/**
 * Menu dishes with live stock. Sold-out dishes stay listed (marked as sold out) so availability
 * changes are visible instead of dishes silently vanishing. The menu polls this.
 * `?all=1` (hidden dishes too) is for the owner only.
 */
export const GET = handle(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1" && (await getSession())?.role === "owner";

  // Returns stock held by abandoned, unpaid orders to the menu.
  await maybeSweep();

  const rows = await query(
    all
      ? "SELECT * FROM dishes ORDER BY category, name"
      : "SELECT * FROM dishes WHERE active = true ORDER BY (stock = 0), category, name",
  );

  return NextResponse.json(
    { dishes: rows, server_time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
});
