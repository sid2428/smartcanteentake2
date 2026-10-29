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
  /** Brings the tray in line with live menu data; returns a note for each change made. */
  reconcile: (dishes: MenuSnapshot[]) => string[];
  totalPaise: number;
  totalItems: number;
};

/** The fields of a live menu dish the tray cares about. */
export type MenuSnapshot = { id: string; name: string; price_paise: number; stock: number };

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

  const reconcile = useCallback(
    (dishes: MenuSnapshot[]) => {
      const byId = new Map(dishes.map((d) => [d.id, d]));
      const notes: string[] = [];
      const next: CartItem[] = [];
      let changed = false;
      for (const item of items) {
        const dish = byId.get(item.dishId);
        if (!dish || dish.stock <= 0) {
          notes.push(`${item.name} sold out and was removed from your tray`);
          changed = true;
          continue;
        }
        let updated = item;
        if (item.qty > dish.stock) {
          notes.push(`Only ${dish.stock} ${dish.name} left, so your tray was updated`);
          updated = { ...updated, qty: dish.stock };
        }
        if (item.pricePaise !== dish.price_paise) {
          notes.push(`${dish.name} now costs ₹${(dish.price_paise / 100).toFixed(dish.price_paise % 100 ? 2 : 0)}`);
          updated = { ...updated, pricePaise: dish.price_paise };
        }
        if (updated !== item) changed = true;
        next.push(updated);
      }
      if (changed) setItems(next);
      return notes;
    },
    [items],
  );

  const totalPaise = items.reduce((s, i) => s + i.pricePaise * i.qty, 0);
  const totalItems = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext value={{ items, add, remove, updateQty, clear, reconcile, totalPaise, totalItems }}>
      {children}
    </CartContext>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
