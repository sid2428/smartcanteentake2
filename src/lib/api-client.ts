/** Shared API client helpers for client components. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }

  /** The request never got a response (offline, server down, timed out). Safe to retry. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

export type ApiInit = RequestInit & { timeoutMs?: number };

export async function api<T = unknown>(path: string, init?: ApiInit): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {};
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  // Honour a caller's own abort signal as well as our timeout.
  rest.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: { "Content-Type": "application/json", ...rest.headers },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (rest.signal?.aborted) throw error;
    if (timedOut) throw new ApiError(0, "The server is taking too long to respond. Please try again.", "TIMEOUT");
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    throw new ApiError(
      0,
      offline ? "You're offline. Check your connection and try again." : "Couldn't reach the server. Please try again.",
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    // Session expired or was wiped by a demo reset: send the user to sign in, then back here.
    if (res.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined") {
      const here = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith("/login")) {
        // A full load (not router.push) on purpose: it drops all state from the expired session.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/login?from=${encodeURIComponent(here)}`);
      }
    }
    throw new ApiError(res.status, body.error ?? "Something went wrong", body.code);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Random idempotency key for one user action (e.g. one checkout attempt). */
export function newRequestKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
