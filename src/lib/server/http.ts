import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  return schema.parse(raw);
}

/** Wraps a route handler so thrown HttpErrors / validation errors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      if (error instanceof ZodError) {
        const first = error.issues[0];
        const where = first?.path.length ? `${first.path.join(".")}: ` : "";
        return NextResponse.json({ error: `${where}${first?.message ?? "Invalid input"}` }, { status: 400 });
      }
      // Postgres errors worth translating: a malformed uuid in the URL, or a CHECK/unique backstop.
      const pgCode = (error as { code?: unknown })?.code;
      if (pgCode === "22P02") {
        return NextResponse.json({ error: "Not found", code: "INVALID_ID" }, { status: 404 });
      }
      if (pgCode === "23514" || pgCode === "23505") {
        return NextResponse.json(
          { error: "That change conflicts with the latest data. Please refresh and try again.", code: "CONFLICT" },
          { status: 409 },
        );
      }
      console.error(error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
