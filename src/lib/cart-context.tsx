"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type CartItem = {
  dishId: string;
  name: string;
  emoji: string;
  pricePaise: number;
  qty: number;
  isVeg: boolean;
};

type CartContextValue = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">) => void;
  remove: (dishId: string) => void;
  updateQty: (dishId: string, qty: number) => void;
  clear: () => void;
  totalPaise: number;
  totalItems: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((item: Omit<CartItem, "qty">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.dishId === item.dishId);
      if (existing) return prev.map((i) => (i.dishId === item.dishId ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const remove = useCallback((dishId: string) => {
    setItems((prev) => prev.filter((i) => i.dishId !== dishId));
  }, []);

  const updateQty = useCallback((dishId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.dishId !== dishId));
    } else {
      setItems((prev) => prev.map((i) => (i.dishId === dishId ? { ...i, qty } : i)));
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalPaise = items.reduce((s, i) => s + i.pricePaise * i.qty, 0);
  const totalItems = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext value={{ items, add, remove, updateQty, clear, totalPaise, totalItems }}>
      {children}
    </CartContext>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
