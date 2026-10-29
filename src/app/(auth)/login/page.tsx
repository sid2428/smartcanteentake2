"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { safeNextPath } from "@/lib/auth-redirect";
import { ROLE_HOME } from "@/lib/constants";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import type { Role } from "@/lib/domain";

const ROLE_INITIAL: Record<Role, string> = { student: "S", staff: "K", owner: "O" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const from = safeNextPath(useSearchParams().get("from"));
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(email: string, password: string, key: string) {
    setBusy(key);
    setError(null);
    try {
      const data = await api<{ user: { name: string; role: Role } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      toast("Welcome, " + data.user.name + "!", "success");
      router.push(from ?? ROLE_HOME[data.user.role]);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    void signIn(email, password, "form");
  }

  async function resetDemo() {
    setBusy("reset");
    setError(null);
    try {
      await api("/api/demo/reset", { method: "POST" });
      toast("Demo data restored", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset demo data");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-stretch lg:gap-6">
      <div className="relative min-h-64 overflow-hidden rounded-3xl bg-[#172B4D] p-6 text-white shadow-[0_14px_34px_rgba(23,43,77,0.12)] sm:p-8 md:min-h-full">
        <Image src="/images/menu/chicken-biryani.jpg" alt="A fresh chicken biryani from Smart Canteen" fill sizes="(max-width: 768px) 100vw, 30vw" className="object-cover opacity-75" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-[#172B4D] via-[#172B4D]/45 to-transparent" />
        <div className="relative flex h-full min-h-64 flex-col justify-end">
          <span className="mb-3 w-fit rounded-full bg-orange-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-orange-100">Made for campus life</span>
          <h2 className="max-w-xs text-2xl font-bold leading-tight sm:text-3xl">Good food. Less waiting.</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-200">Order from your phone, choose a pickup slot, and get back to class on time.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr] sm:items-start sm:gap-5">
      <Card className="p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Try a demo account</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">One click, no sign-up needed.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy !== null}
              aria-label={"Sign in as " + a.role + ", " + a.name}
              aria-busy={busy === a.id}
              onClick={() => signIn(a.email, DEMO_PASSWORD, a.id)}
              className="group flex min-h-18 items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 text-left transition-colors hover:border-orange-400 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-orange-500/70 dark:hover:bg-orange-950/20"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-sm font-bold text-orange-700 transition-colors group-hover:bg-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:group-hover:bg-orange-900/70"
                aria-hidden
              >
                {ROLE_INITIAL[a.role]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                  {busy === a.id ? "Signing in..." : a.role + " - " + a.name}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{a.blurb}</span>
              </span>
              <span className="shrink-0 text-zinc-400 transition-colors group-hover:text-orange-600" aria-hidden>
                -&gt;
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetDemo}
          disabled={busy !== null}
          aria-busy={busy === "reset"}
          className="mt-5 w-full rounded-md py-1 text-center text-xs text-zinc-500 transition-colors hover:text-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-500 dark:hover:text-orange-400"
        >
          {busy === "reset" ? "Resetting..." : "Reset demo data"}
        </button>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Sign in</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Use your college account to continue.</p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Sign in form">
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <Input name="email" label="Email" type="email" placeholder="you@college.edu" autoComplete="email" required />
          <Input
            name="password"
            label="Password"
            type="password"
            placeholder="******"
            autoComplete="current-password"
            required
          />
          <Button type="submit" disabled={busy !== null} className="mt-1 h-11 w-full">
            {busy === "form" ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="rounded-sm font-medium text-orange-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:text-orange-400">
            Sign up
          </Link>
        </p>
      </Card>
      </div>
    </div>
  );
}
