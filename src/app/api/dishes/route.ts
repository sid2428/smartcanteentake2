import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query } from "@/lib/server/db";

/** Public: list active dishes for the menu. Owner sees all. */
export const GET = handle(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1";

  const rows = await query(
    all
      ? "SELECT * FROM dishes ORDER BY category, name"
      : "SELECT * FROM dishes WHERE active = true AND stock > 0 ORDER BY category, name",
  );

  return NextResponse.json({ dishes: rows });
});
