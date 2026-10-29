"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Arrow } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { safeNextPath } from "@/lib/auth-redirect";
import { ROLE_HOME } from "@/lib/constants";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import type { Role } from "@/lib/domain";

const ROLE_ICON: Record<Role, string> = { student: "🎓", staff: "👨‍🍳", owner: "📊" };
const ROLE_TINT: Record<Role, string> = {
  student: "bg-forest-100",
  staff: "bg-terra-100",
  owner: "bg-cream-300",
};

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
      toast(`Welcome, ${data.user.name}!`, "success");
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
    <div className="flex flex-col">
      <div className="animate-rise">
        <p className="eyebrow mb-3">Welcome back</p>
        <h1 className="font-display text-[2.6rem] font-light leading-[1.05] tracking-tight text-ink">
          What&apos;s on the <span className="italic text-forest-700">menu</span> today?
        </h1>
      </div>

      {/* Demo accounts */}
      <section className="mt-10 animate-rise [animation-delay:80ms]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Try a demo account</h2>
          <span className="text-xs text-ink-muted">One click, no sign-up</span>
        </div>
        <div className="stagger flex flex-col">
          {DEMO_ACCOUNTS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              disabled={busy !== null}
              onClick={() => signIn(a.email, DEMO_PASSWORD, a.id)}
              style={{ "--i": i + 2 } as React.CSSProperties}
              className="group flex items-center gap-4 border-b border-cream-300 py-4 text-left transition-all duration-300 first:border-t hover:pl-2 disabled:opacity-50"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl transition-transform duration-500 group-hover:scale-110 ${ROLE_TINT[a.role]}`}
                aria-hidden
              >
                {ROLE_ICON[a.role]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-semibold text-ink">
                  {busy === a.id ? "Signing in…" : (
                    <>
                      <span className="capitalize">{a.role}</span>
                      <span className="font-normal text-ink-muted"> · {a.name}</span>
                    </>
                  )}
                </span>
                <span className="block truncate text-[0.8rem] text-ink-muted">{a.blurb}</span>
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint transition-all duration-300 group-hover:bg-forest-700 group-hover:text-cream-50">
                <Arrow />
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetDemo}
          disabled={busy !== null}
          className="mt-4 text-xs font-medium text-ink-muted underline-offset-4 transition-colors hover:text-terra-600 hover:underline disabled:opacity-50"
        >
          {busy === "reset" ? "Resetting…" : "↺ Reset demo data"}
        </button>
      </section>

      <div className="my-10 flex items-center gap-4 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-cream-300" />
        or sign in with email
        <span className="h-px flex-1 bg-cream-300" />
      </div>

      <form onSubmit={onSubmit} className="flex animate-rise flex-col gap-5 [animation-delay:200ms]">
        {error && (
          <p className="animate-pop rounded-2xl bg-terra-50 px-4 py-3 text-sm text-terra-700 ring-1 ring-inset ring-terra-200">
            {error}
          </p>
        )}
        <Input name="email" label="Email" type="email" placeholder="you@college.edu" autoComplete="email" required />
        <Input
          name="password"
          label="Password"
          type="password"
          placeholder="••••••"
          autoComplete="current-password"
          required
        />
        <Button type="submit" size="lg" disabled={busy !== null} className="mt-1 w-full">
          {busy === "form" ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-forest-700 underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
