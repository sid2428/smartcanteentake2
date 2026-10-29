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
      console.error(error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
