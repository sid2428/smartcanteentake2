import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { getSession } from "@/lib/server/auth";

export const GET = handle(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: session.uid, name: session.name, role: session.role } });
});
