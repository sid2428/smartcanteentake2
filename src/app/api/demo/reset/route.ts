import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { resetDemoDatabase } from "@/lib/server/db";

/** POST /api/demo/reset - wipe all changes and restore the original demo data. */
export const POST = handle(async () => {
  await resetDemoDatabase();
  return NextResponse.json({ ok: true });
});
