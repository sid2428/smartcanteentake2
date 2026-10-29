"use client";

import { CartProvider } from "@/lib/cart-context";
import { AppNav } from "@/components/app-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <AppNav />
      <main className="mx-auto min-w-0 w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </CartProvider>
  );
}
