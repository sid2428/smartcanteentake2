"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";

export type LiveState<T> = {
  data: T | null;
  /** Last fetch error. With `data` present the page keeps showing it, marked as stale. */
  error: ApiError | Error | null;
  loading: boolean;
  /** Data is showing but the latest refresh failed (e.g. a dropped connection). */
  stale: boolean;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
};

/**
 * Fetches `load()` now and every `intervalMs`, for live screens (order tracking, kitchen, stock).
 * Pauses while the tab is hidden, refreshes as soon as it's visible or back online, backs off
 * after errors, and ignores responses that arrive out of order.
 */
export function useLive<T>(
  load: () => Promise<T>,
  { intervalMs, enabled = true, key = "" }: { intervalMs: number; enabled?: boolean; key?: string },
): LiveState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const generation = useRef(0);
  const failures = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const next = await loadRef.current();
      if (mine !== generation.current) return;
      failures.current = 0;
      setData(next);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      if (mine !== generation.current) return;
      failures.current++;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      // Back off to at most 4× the interval (and ≤ 60 s) while requests keep failing.
      const delay = Math.min(intervalMs * 2 ** Math.min(failures.current, 2), Math.max(intervalMs, 60_000));
      timer = setTimeout(tick, delay);
    };
    const tick = async () => {
      if (document.visibilityState === "visible") await refresh();
      schedule();
    };
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      // A request counter, not a DOM ref: bumping it drops any response still in flight for the old key.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [enabled, intervalMs, key, refresh]);

  return { data, error, loading, stale: !!error && data !== null, lastUpdated, refresh };
}
