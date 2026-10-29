import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { queryOne } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/passwords";
import { startSession } from "@/lib/server/auth";
import type { Role } from "@/lib/domain";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const POST = handle(async (request: Request) => {
  const { email, password } = await parseBody(request, LoginSchema);

  const user = await queryOne<{ id: string; name: string; role: Role; password_hash: string }>(
    "SELECT id, name, role, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()],
  );

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, "Invalid email or password");
  }

  await startSession(user);

  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
});
