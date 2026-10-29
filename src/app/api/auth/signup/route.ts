import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { queryOne } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/passwords";
import { startSession } from "@/lib/server/auth";
import type { Role } from "@/lib/domain";

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  collegeId: z.string().max(50).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export const POST = handle(async (request: Request) => {
  const body = await parseBody(request, SignupSchema);

  const existing = await queryOne("SELECT id FROM users WHERE email = $1", [body.email.toLowerCase()]);
  if (existing) throw new HttpError(409, "An account with this email already exists", "EMAIL_TAKEN");

  const passwordHash = await hashPassword(body.password);
  const user = await queryOne<{ id: string; role: Role; name: string }>(
    `INSERT INTO users (name, email, college_id, role, password_hash)
     VALUES ($1, $2, $3, 'student', $4)
     RETURNING id, role, name`,
    [body.name, body.email.toLowerCase(), body.collegeId ?? null, passwordHash],
  );
  if (!user) throw new HttpError(500, "Could not create account");

  await startSession(user);

  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } }, { status: 201 });
});
