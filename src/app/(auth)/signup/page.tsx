"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const collegeId = String(form.get("collegeId") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!name || !email || !password) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, collegeId: collegeId || undefined, password }),
      });
      toast("Account created! Welcome to Smart Canteen 🎉", "success");
      router.push("/menu");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="animate-rise">
        <p className="eyebrow mb-3">Join the canteen</p>
        <h1 className="font-display text-[2.6rem] font-light leading-[1.05] tracking-tight text-ink">
          Create your <span className="italic text-forest-700">account</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Demo mode: new accounts are removed when the demo data is reset.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-10 grid animate-rise grid-cols-1 gap-5 [animation-delay:100ms] sm:grid-cols-2">
        {error && (
          <p className="animate-pop rounded-2xl bg-terra-50 px-4 py-3 text-sm text-terra-700 ring-1 ring-inset ring-terra-200 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <Input name="name" label="Full name" placeholder="Asha Sharma" autoComplete="name" required />
        </div>
        <div className="sm:col-span-2">
          <Input name="email" label="Email" type="email" placeholder="you@college.edu" autoComplete="email" required />
        </div>
        <Input name="collegeId" label="College ID (optional)" placeholder="CS-2024-001" />
        <Input
          name="password"
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          autoComplete="new-password"
          required
          minLength={6}
        />
        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full sm:col-span-2">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-forest-700 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
