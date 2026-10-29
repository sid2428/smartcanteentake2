"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ROUTES, ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/lib/domain";

type User = { id: string; name: string; role: Role } | null;

const studentLinks = [
  { href: ROUTES.menu, label: "Menu" },
  { href: ROUTES.orders, label: "Orders" },
  { href: ROUTES.tickets, label: "Tickets" },
];
const staffLinks = [
  { href: ROUTES.kitchen, label: "Kitchen" },
  { href: ROUTES.scan, label: "Scan QR" },
];
const ownerLinks = [
  { href: ROUTES.owner, label: "Dashboard" },
  { href: ROUTES.ownerDishes, label: "Dishes" },
  { href: ROUTES.kitchen, label: "Kitchen" },
  { href: ROUTES.scan, label: "Scan QR" },
  { href: ROUTES.ownerSettings, label: "Settings" },
  { href: ROUTES.ownerRefunds, label: "Refunds" },
];

function linksForRole(role: Role) {
  if (role === "owner") return ownerLinks;
  if (role === "staff") return staffLinks;
  return studentLinks;
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me").then((d) => setUser(d.user)).catch(() => {});
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = user ? linksForRole(user.role) : [];

  return (
    <header className="sticky top-0 z-40 border-b border-canteen-200 bg-white/95 shadow-[0_2px_12px_rgba(120,75,35,0.04)] backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={user ? ROLE_HOME[user.role] : "/login"} className="flex shrink-0 items-center gap-2.5 rounded-lg text-base font-bold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 sm:text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-xs font-bold text-white" aria-hidden>
            SC
          </span>
          Smart Canteen
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "rounded-lg bg-orange-100 px-3 py-2 text-sm font-medium text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" : "rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-canteen-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"}
              >
                {l.label}
              </Link>
            );
          })}
          {user && (
            <button onClick={logout} className="ml-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-canteen-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
              Sign out
            </button>
          )}
        </nav>

        <button
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-canteen-100 lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {menuOpen && (
        <nav aria-label="Mobile navigation" className="border-t border-canteen-200 bg-white px-4 pb-4 pt-2 lg:hidden">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={active ? "block rounded-lg bg-orange-100 px-3 py-2.5 text-sm font-medium text-orange-700" : "block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-canteen-100 hover:text-ink-900"}
              >
                {l.label}
              </Link>
            );
          })}
          {user && (
            <button onClick={logout} className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-500 hover:bg-canteen-100 hover:text-ink-900">
              Sign out ({user.name})
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
