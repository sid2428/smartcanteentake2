"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useCart } from "@/lib/cart-context";
import { ROUTES, ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/lib/domain";
import { Logo } from "@/components/logo";

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
  { href: ROUTES.owner, label: "Overview" },
  { href: ROUTES.ownerDishes, label: "Dishes" },
  { href: ROUTES.kitchen, label: "Kitchen" },
  { href: ROUTES.scan, label: "Scan QR" },
  { href: ROUTES.ownerSettings, label: "Settings" },
  { href: ROUTES.ownerRefunds, label: "Refunds" },
];

const ROLE_LABEL: Record<Role, string> = { student: "Student", staff: "Kitchen staff", owner: "Owner" };

function linksForRole(role: Role) {
  if (role === "owner") return ownerLinks;
  if (role === "staff") return staffLinks;
  return studentLinks;
}

function isActive(pathname: string, href: string) {
  // "/owner" should not stay highlighted on "/owner/dishes".
  if (href === ROUTES.owner) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const [user, setUser] = useState<User>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me").then((d) => setUser(d.user)).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = user ? linksForRole(user.role) : [];
  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "";

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-500 ${
        // No backdrop-filter while the menu is open: it would make the fixed menu position relative to the header.
        menuOpen
          ? "bg-cream-100 shadow-[0_1px_0_var(--color-cream-300)]"
          : scrolled
            ? "bg-cream-100/85 shadow-[0_1px_0_var(--color-cream-300)] backdrop-blur-xl"
            : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href={user ? ROLE_HOME[user.role] : "/login"} className="shrink-0" onClick={() => setMenuOpen(false)}>
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-full px-4 py-2 text-[0.9rem] font-medium transition-colors duration-300 ${
                  active ? "text-forest-800" : "text-ink-muted hover:text-ink"
                }`}
              >
                {l.label}
                {l.href === ROUTES.menu && totalItems > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-terra-500 px-1.5 text-[0.65rem] font-bold text-cream-50">
                    {totalItems}
                  </span>
                )}
                <span
                  className={`absolute inset-x-4 -bottom-0.5 h-[2px] origin-left rounded-full bg-forest-600 transition-transform duration-500 ease-[var(--ease-out-soft)] ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user && (
            <>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-100 font-display text-sm text-forest-800">
                  {initial}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-ink">{user.name}</span>
                  <span className="block text-[0.7rem] text-ink-muted">{ROLE_LABEL[user.role]}</span>
                </span>
              </div>
              <button
                onClick={logout}
                className="ml-2 rounded-full border border-cream-300 px-4 py-2 text-[0.8rem] font-semibold text-ink-soft transition-colors hover:border-terra-300 hover:text-terra-600"
              >
                Sign out
              </button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-cream-200/70 text-ink lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <span className="relative block h-3 w-5">
            <span
              className={`absolute left-0 h-[1.5px] w-5 rounded bg-current transition-all duration-300 ${menuOpen ? "top-1.5 rotate-45" : "top-0"}`}
            />
            <span
              className={`absolute left-0 h-[1.5px] w-5 rounded bg-current transition-all duration-300 ${menuOpen ? "top-1.5 -rotate-45" : "top-3"}`}
            />
          </span>
          {totalItems > 0 && !menuOpen && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-cream-100 bg-terra-500" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav
          className="fixed inset-x-0 bottom-0 top-18 z-40 flex animate-fade flex-col overflow-y-auto bg-cream-100 px-5 pb-10 pt-4 sm:px-8 lg:hidden"
          aria-label="Main"
        >
          <div className="stagger flex flex-col">
            {links.map((l, i) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ "--i": i } as React.CSSProperties}
                  className="flex items-center justify-between border-b border-cream-300 py-5"
                >
                  <span className={`font-display text-3xl font-light tracking-tight ${active ? "italic text-forest-700" : "text-ink"}`}>
                    {l.label}
                  </span>
                  {l.href === ROUTES.menu && totalItems > 0 ? (
                    <span className="rounded-full bg-terra-500 px-2.5 py-0.5 text-xs font-bold text-cream-50">
                      {totalItems} in tray
                    </span>
                  ) : (
                    active && <span className="h-2 w-2 rounded-full bg-forest-600" />
                  )}
                </Link>
              );
            })}
          </div>
          {user && (
            <div className="mt-auto flex items-center justify-between pt-10">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-100 font-display text-forest-800">
                  {initial}
                </span>
                <span className="leading-tight">
                  <span className="block font-semibold text-ink">{user.name}</span>
                  <span className="block text-xs text-ink-muted">{ROLE_LABEL[user.role]}</span>
                </span>
              </div>
              <button
                onClick={logout}
                className="rounded-full border border-cream-400 px-5 py-2.5 text-sm font-semibold text-ink-soft"
              >
                Sign out
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
