import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { endSession } from "@/lib/server/auth";

export const POST = handle(async () => {
  await endSession();
  return NextResponse.json({ ok: true });
});
