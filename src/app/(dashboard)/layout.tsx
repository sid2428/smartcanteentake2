"use client";

import { CartProvider } from "@/lib/cart-context";
import { AppNav } from "@/components/app-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-8 sm:px-8 sm:pt-12 lg:pb-20">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-5 pb-8 text-xs text-ink-faint sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-300 pt-6">
          <span className="font-display italic">Smart Canteen</span>
          <span>Fresh from the kitchen, ready when you are.</span>
        </div>
      </footer>
    </CartProvider>
  );
}
