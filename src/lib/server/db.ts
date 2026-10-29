import "server-only";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase } from "./demo/seed";

/**
 * In-memory demo database (PGlite: Postgres compiled to WASM, running in this process).
 * Created and seeded on first use; everything resets when the server restarts or on
 * `resetDemoDatabase()`. Kept on globalThis so dev hot-reloads don't wipe it.
 */
const store = globalThis as typeof globalThis & { __canteenDb?: Promise<PGlite> };

function db(): Promise<PGlite> {
  if (!store.__canteenDb) {
    store.__canteenDb = createDemoDatabase().catch((error: unknown) => {
      store.__canteenDb = undefined; // let the next request retry
      throw error;
    });
  }
  return store.__canteenDb;
}

/** Throws away all changes and re-seeds the demo data. */
export async function resetDemoDatabase(): Promise<void> {
  const old = store.__canteenDb;
  store.__canteenDb = undefined;
  await db();
  await old?.then((d) => d.close()).catch(() => undefined);
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await db()).query<T>(text, params)).rows;
}

export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export type Tx = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null>;
};

/** Runs `fn` inside BEGIN/COMMIT; any thrown error rolls the transaction back and is rethrown. */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await db()).transaction(async (t) => {
    const tx: Tx = {
      async query<R>(text: string, params: unknown[] = []) {
        return (await t.query<R>(text, params)).rows;
      },
      async queryOne<R>(text: string, params: unknown[] = []) {
        return (await t.query<R>(text, params)).rows[0] ?? null;
      },
    };
    return fn(tx);
  });
}
