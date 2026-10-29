"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Loading, EmptyState, ErrorState, LiveIndicator } from "@/components/ui/page";
import { DishPhoto, DishThumb, DietMark } from "@/components/dish-photo";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, newRequestKey } from "@/lib/api-client";
import { useLive } from "@/lib/use-live";
import { SCENES } from "@/lib/dish-images";
import { formatINR, formatTime, formatDay } from "@/lib/domain";

type Dish = {
  id: string;
  name: string;
  description: string;
  category: string;
  counter: string;
  price_paise: number;
  stock: number;
  prep_minutes: number;
  is_veg: boolean;
  emoji: string;
};

type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked: number;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function MenuPage() {
  const { items: cartItems, add, updateQty, totalPaise, totalItems, clear, reconcile } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [category, setCategory] = useState<string>("All");
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [ordering, setOrdering] = useState(false);
  const [trayRequested, setTrayOpen] = useState(false);
  // The mobile tray sheet closes itself once it has nothing in it.
  const trayOpen = trayRequested && cartItems.length > 0;

  // Synchronous guard: a double tap can fire twice before `ordering` re-renders.
  const submitting = useRef(false);
  // One idempotency key per checkout attempt. Kept across retries of the same tray + slot (so a
  // retry after a dropped connection can't place a second order), replaced when either changes.
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  // Live stock: refreshed every few seconds so sold-out dishes and "only N left" update instantly.
  const menu = useLive(
    async () => {
      const res = await api<{ dishes: Dish[] }>("/api/dishes");
      for (const note of reconcile(res.dishes)) toast(note, "info");
      return res.dishes;
    },
    { intervalMs: 8_000 },
  );

  // Slots fill up too; drop the selection if the chosen slot disappears.
  const slotsLive = useLive(
    async () => {
      const res = await api<{ slots: Slot[] }>("/api/slots");
      setSelectedSlot((prev) => (res.slots.some((s) => s.id === prev) ? prev : (res.slots[0]?.id ?? "")));
      return res.slots;
    },
    { intervalMs: 30_000 },
  );

  const dishes = useMemo(() => menu.data ?? [], [menu.data]);
  const slots = slotsLive.data ?? [];

  useEffect(() => {
    document.body.style.overflow = trayOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [trayOpen]);

  const categories = ["All", ...Array.from(new Set(dishes.map((d) => d.category)))];

  const filteredDishes = dishes.filter((d) => {
    if (category !== "All" && d.category !== category) return false;
    if (vegOnly && !d.is_veg) return false;
    return true;
  });

  async function handleCheckout() {
    if (submitting.current) return;
    if (!selectedSlot) {
      toast("Please select a pickup slot", "error");
      return;
    }
    if (cartItems.length === 0) {
      toast("Your cart is empty", "error");
      return;
    }

    const items = cartItems.map((i) => ({ dishId: i.dishId, qty: i.qty }));
    const signature = JSON.stringify([selectedSlot, items]);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newRequestKey() };

    submitting.current = true;
    setOrdering(true);
    try {
      const res = await api<{ order: { id: string; code: string } }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ slotId: selectedSlot, items, clientRef: attempt.current.key }),
      });

      attempt.current = null;
      clear();
      toast(`Order placed! Code: ${res.order.code}`, "success");
      router.push(`/orders/${res.order.id}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "OUT_OF_STOCK" || code === "DISH_UNAVAILABLE") void menu.refresh();
      if (code === "SLOT_FULL") void slotsLive.refresh();
      toast(errorMessage(err, "Failed to place order"), "error");
    } finally {
      submitting.current = false;
      setOrdering(false);
    }
  }

  if (menu.loading && !menu.data) {
    return <Loading label="Setting the table…" />;
  }

  if (!menu.data) {
    return (
      <ErrorState
        title="The menu didn't load"
        message={errorMessage(menu.error, "Please check your connection and try again.")}
        onRetry={() => void menu.refresh()}
      />
    );
  }

  const trayProps: TrayProps = {
    slots,
    selectedSlot,
    onSelectSlot: setSelectedSlot,
    items: cartItems,
    dishes,
    updateQty: (dishId, qty) => {
      if (qty <= 0 && cartItems.length === 1) setTrayOpen(false);
      updateQty(dishId, qty);
    },
    totalPaise,
    ordering,
    onCheckout: handleCheckout,
  };

  return (
    <div>
      {/* Hero */}
      <section className="mb-14 grid items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div className="animate-rise">
          <p className="eyebrow mb-4">{greeting()}</p>
          <h1 className="font-display text-[2.6rem] font-light leading-[1.02] tracking-tight text-ink sm:text-6xl">
            Freshly made,
            <br />
            <span className="italic text-forest-700">ready when you are.</span>
          </h1>
          <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-ink-muted">
            Pick your dishes, choose a pickup slot, and skip the queue. We&apos;ll have it hot at the counter.
          </p>
          <LiveIndicator stale={menu.stale} className="mt-5" />
        </div>
        <div className="relative hidden h-56 w-[22rem] animate-fade sm:block" aria-hidden>
          <div className="absolute right-24 top-0 h-52 w-52 overflow-hidden rounded-full shadow-lift ring-8 ring-cream-100">
            <Image src={SCENES.thaliSpread} alt="" fill sizes="208px" className="object-cover" preload />
          </div>
          <div className="absolute bottom-0 right-0 h-36 w-36 overflow-hidden rounded-full shadow-lift ring-8 ring-cream-100">
            <Image src={SCENES.chaiPour} alt="" fill sizes="144px" className="object-cover" />
          </div>
          <span className="absolute -left-2 top-10 rotate-[-8deg] rounded-full bg-terra-500 px-4 py-2 font-display text-sm italic text-cream-50 shadow-soft">
            {dishes.filter((d) => d.stock > 0).length} dishes today
          </span>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-18 z-30 -mx-5 mb-10 bg-cream-100/90 px-5 py-3 backdrop-blur-lg sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="no-scrollbar -my-1 flex gap-1 overflow-x-auto py-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  category === c
                    ? "bg-forest-700 text-cream-50 shadow-[0_6px_16px_-8px_rgb(27_52_36/0.6)]"
                    : "text-ink-muted hover:bg-cream-200 hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="flex shrink-0 cursor-pointer select-none items-center gap-2.5 text-sm font-medium text-ink-soft">
            <span className="hidden sm:inline">Veg only</span>
            <DietMark veg className="sm:hidden" />
            <input
              type="checkbox"
              checked={vegOnly}
              onChange={(e) => setVegOnly(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className="relative h-6 w-11 rounded-full bg-cream-300 transition-colors duration-300 peer-checked:bg-forest-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-300 peer-checked:after:translate-x-5"
              aria-hidden
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem] xl:gap-16">
        {/* Dishes */}
        <section aria-label="Dishes">
          {filteredDishes.length === 0 ? (
            <EmptyState icon="🥗" title="Nothing here just yet">
              Try another category, or turn off the veg filter.
            </EmptyState>
          ) : (
            <div key={`${category}-${vegOnly}`} className="stagger grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
              {filteredDishes.map((dish, i) => {
                const inCart = cartItems.find((i) => i.dishId === dish.id);
                const soldOut = dish.stock <= 0;
                return (
                  <article key={dish.id} className="group" style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                    <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] bg-cream-200 shadow-soft">
                      <DishPhoto
                        name={dish.name}
                        emoji={dish.emoji}
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"
                        eager={i < 4}
                        className={`transition-transform duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.06] ${soldOut ? "grayscale" : ""}`}
                      />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                        <span className="flex items-center gap-1.5 rounded-full bg-cream-50/90 px-2.5 py-1 text-[0.7rem] font-semibold text-ink-soft backdrop-blur">
                          <DietMark veg={dish.is_veg} className="!h-3 !w-3 after:!h-1.5 after:!w-1.5" />
                          {dish.is_veg ? "Veg" : "Non-veg"}
                        </span>
                        <span className="rounded-full bg-cream-50/90 px-2.5 py-1 text-[0.7rem] font-semibold text-ink-soft backdrop-blur">
                          {dish.prep_minutes} min
                        </span>
                      </div>
                      {soldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-cream-100/50">
                          <span className="rounded-full bg-ink px-4 py-2 font-display text-sm italic text-cream-50">Sold out</span>
                        </div>
                      )}
                      {inCart && (
                        <span className="absolute bottom-4 left-4 animate-pop rounded-full bg-forest-700 px-3 py-1 text-xs font-semibold text-cream-50">
                          {inCart.qty} in tray
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-[1.4rem] font-normal leading-tight tracking-tight text-ink">
                          {dish.name}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{dish.description}</p>
                        <p className="mt-2 text-xs font-medium text-ink-faint">
                          {dish.counter} counter
                          {dish.stock > 0 && dish.stock <= 10 && (
                            <span className="text-terra-500"> · Only {dish.stock} left</span>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-xl text-forest-700">{formatINR(dish.price_paise)}</span>
                    </div>

                    <div className="mt-4">
                      {inCart ? (
                        <Stepper
                          qty={inCart.qty}
                          onDec={() => updateQty(dish.id, inCart.qty - 1)}
                          onInc={() => updateQty(dish.id, inCart.qty + 1)}
                          incDisabled={inCart.qty >= dish.stock}
                          name={dish.name}
                        />
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="group/add"
                          onClick={() =>
                            add({
                              dishId: dish.id,
                              name: dish.name,
                              emoji: dish.emoji,
                              pricePaise: dish.price_paise,
                              isVeg: dish.is_veg,
                            })
                          }
                          disabled={soldOut}
                        >
                          {soldOut ? (
                            "Sold Out"
                          ) : (
                            <>
                              <span className="text-base leading-none transition-transform duration-300 group-hover/add:rotate-90">+</span>
                              Add to tray
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Desktop tray */}
        <aside className="hidden lg:block">
          <div className="sticky top-40 animate-rise [animation-delay:150ms]">
            <Tray {...trayProps} />
          </div>
        </aside>
      </div>

      {/* Mobile tray bar + sheet */}
      {cartItems.length > 0 && !trayOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4 lg:hidden">
          <button
            onClick={() => setTrayOpen(true)}
            className="mx-auto flex w-full max-w-lg animate-rise items-center gap-3 rounded-full bg-forest-800 py-2.5 pl-2.5 pr-5 text-left text-cream-50 shadow-lift"
          >
            <span className="flex -space-x-3">
              {cartItems.slice(0, 3).map((i) => (
                <DishThumb key={i.dishId} name={i.name} emoji={i.emoji} size="h-10 w-10" className="ring-2 ring-forest-800" />
              ))}
            </span>
            <span className="flex-1 leading-tight">
              <span className="block text-sm font-semibold">View tray</span>
              <span className="block text-xs text-forest-200">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            </span>
            <span className="font-display text-lg">{formatINR(totalPaise)}</span>
          </button>
        </div>
      )}

      {trayOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Your tray">
          <button
            className="absolute inset-0 animate-fade bg-forest-900/45 backdrop-blur-[2px]"
            onClick={() => setTrayOpen(false)}
            aria-label="Close tray"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] animate-sheet overflow-y-auto rounded-t-[2rem] bg-cream-50 px-5 pb-8 pt-3 shadow-lift sm:px-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-cream-300" />
            <div className="mx-auto max-w-lg">
              <Tray {...trayProps} bare />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type TrayProps = {
  slots: Slot[];
  selectedSlot: string;
  onSelectSlot: (id: string) => void;
  items: CartItem[];
  dishes: Dish[];
  updateQty: (dishId: string, qty: number) => void;
  totalPaise: number;
  ordering: boolean;
  onCheckout: () => void;
  bare?: boolean;
};

function Tray({ slots, selectedSlot, onSelectSlot, items, dishes, updateQty, totalPaise, ordering, onCheckout, bare }: TrayProps) {
  return (
    <div className={bare ? "" : "rounded-[2rem] bg-cream-50 p-7 shadow-soft"}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-light tracking-tight text-ink">
          Your <span className="italic text-forest-700">tray</span>
        </h2>
        {items.length > 0 && (
          <span className="text-xs text-ink-muted">{items.reduce((s, i) => s + i.qty, 0)} items</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cream-200 text-xl" aria-hidden>
            🍽️
          </span>
          <p className="text-sm text-ink-muted">Cart is empty</p>
          <p className="mt-1 text-xs text-ink-faint">Add a dish to get started.</p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col divide-y divide-cream-200">
          {items.map((item) => {
            const stock = dishes.find((d) => d.id === item.dishId)?.stock ?? Infinity;
            return (
              <li key={item.dishId} className="flex animate-rise items-center gap-3 py-3.5">
                <DishThumb name={item.name} emoji={item.emoji} size="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                  <p className="text-xs text-ink-muted">
                    {formatINR(item.pricePaise)} × {item.qty}
                  </p>
                </div>
                <Stepper
                  small
                  qty={item.qty}
                  onDec={() => updateQty(item.dishId, item.qty - 1)}
                  onInc={() => updateQty(item.dishId, item.qty + 1)}
                  incDisabled={item.qty >= stock}
                  name={item.name}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 border-t border-dashed border-cream-300 pt-6">
        <p className="mb-3 flex items-center gap-2 text-[0.8rem] font-semibold text-ink-soft">
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-forest-600" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="10" cy="10" r="7.25" />
            <path d="M10 6v4l2.5 2" strokeLinecap="round" />
          </svg>
          Pickup slot
        </p>
        {slots.length === 0 ? (
          <p className="rounded-2xl bg-terra-50 px-4 py-3 text-sm text-terra-700">
            No slots currently available. Please check back later!
          </p>
        ) : (
          <Select value={selectedSlot} onChange={(e) => onSelectSlot(e.target.value)} aria-label="Pickup slot" className="!text-sm">
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDay(s.starts_at)}: {formatTime(s.starts_at)} - {formatTime(s.ends_at)} ({s.capacity - s.booked} left)
              </option>
            ))}
          </Select>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="mt-6 flex items-baseline justify-between">
            <span className="text-sm text-ink-muted">Total Amount</span>
            <span className="font-display text-3xl text-ink">{formatINR(totalPaise)}</span>
          </div>
          <Button size="lg" className="mt-5 w-full" disabled={ordering || slots.length === 0} onClick={onCheckout}>
            {ordering ? "Placing Order…" : "Checkout Order"}
          </Button>
          <p className="mt-3 text-center text-[0.7rem] text-ink-faint">Pay by UPI on the next step</p>
        </>
      )}
    </div>
  );
}

function Stepper({
  qty,
  onDec,
  onInc,
  incDisabled,
  name,
  small,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
  incDisabled?: boolean;
  name: string;
  small?: boolean;
}) {
  const btn = `${small ? "h-7 w-7 text-sm" : "h-9 w-9"} flex items-center justify-center rounded-full transition-all duration-200 hover:bg-cream-50 active:scale-90 disabled:opacity-30 disabled:pointer-events-none`;
  return (
    <div className={`inline-flex items-center rounded-full bg-cream-200 p-0.5 ${small ? "" : "gap-1"}`}>
      <button className={btn} onClick={onDec} aria-label={`Remove one ${name}`}>
        −
      </button>
      <span key={qty} className={`animate-pop text-center font-semibold tabular-nums text-ink ${small ? "w-5 text-xs" : "w-7 text-sm"}`}>
        {qty}
      </span>
      <button className={btn} onClick={onInc} disabled={incDisabled} aria-label={`Add one ${name}`}>
        +
      </button>
    </div>
  );
}
