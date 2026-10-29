"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
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

export default function MenuPage() {
  const { items: cartItems, add, updateQty, totalPaise, totalItems, clear } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [category, setCategory] = useState<string>("All");
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [query, setQuery] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [dishesRes, slotsRes] = await Promise.all([
          api<{ dishes: Dish[] }>("/api/dishes"),
          api<{ slots: Slot[] }>("/api/slots")
        ]);
        setDishes(dishesRes.dishes);
        setSlots(slotsRes.slots);
        if (slotsRes.slots.length > 0) {
          setSelectedSlot(slotsRes.slots[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = ["All", ...Array.from(new Set(dishes.map((d) => d.category)))];

  const filteredDishes = dishes.filter((d) => {
    if (category !== "All" && d.category !== category) return false;
    if (vegOnly && !d.is_veg) return false;
    if (query && !`${d.name} ${d.description} ${d.category}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const featuredDish = dishes.find((d) => d.stock > 0) ?? dishes[0];

  async function handleCheckout() {
    if (!selectedSlot) {
      toast("Please select a pickup slot", "error");
      return;
    }
    if (cartItems.length === 0) {
      toast("Your cart is empty", "error");
      return;
    }

    setOrdering(true);
    try {
      const res = await api<{ order: { id: string; code: string } }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          slotId: selectedSlot,
          items: cartItems.map((i) => ({ dishId: i.dishId, qty: i.qty })),
        }),
      });

      clear();
      toast(`Order placed! Code: ${res.order.code}`, "success");
      router.push(`/orders/${res.order.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to place order", "error");
    } finally {
      setOrdering(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-canteen-200 bg-white py-16 text-center text-slate-500 shadow-sm">Loading menu & available slots...</div>;
  }

  return (
    <div className={`min-w-0 space-y-6 ${cartItems.length > 0 ? "pb-28 lg:pb-0" : ""}`}>
      <div>
        <p className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">Today&apos;s menu</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">What are you craving?</h1>
        <p className="mt-1 text-sm text-slate-500">Fresh, affordable meals ready for pickup on campus.</p>
      </div>
      {featuredDish && (
        <div className="relative isolate overflow-hidden rounded-3xl bg-[#172B4D] text-white shadow-[0_14px_34px_rgba(23,43,77,0.16)]">
          <div className="grid min-h-56 md:grid-cols-[1fr_0.95fr]">
            <div className="relative order-2 min-h-52 md:order-1">
              <FoodPhoto dish={featuredDish} priority className="absolute inset-0 h-full w-full rounded-none" />
            </div>
            <div className="relative order-1 flex flex-col justify-center p-6 sm:p-8 md:order-2">
              <span className="mb-3 w-fit rounded-full bg-orange-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-orange-200">Today&apos;s special</span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{featuredDish.name}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-200">{featuredDish.description}</p>
              <div className="mt-5 flex items-center gap-4">
                <span className="text-xl font-bold">{formatINR(featuredDish.price_paise)}</span>
                <Button size="sm" onClick={() => add({ dishId: featuredDish.id, name: featuredDish.name, emoji: featuredDish.emoji, pricePaise: featuredDish.price_paise, isVeg: featuredDish.is_veg })} disabled={featuredDish.stock <= 0}>
                  Add to tray
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Menu Section */}
      <div className="lg:col-span-2">
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <span className="sr-only">Search dishes</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes..." className="h-11 w-full rounded-xl border border-canteen-200 bg-white px-4 text-sm text-ink-900 placeholder:text-slate-500 shadow-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15" />
            </label>
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{filteredDishes.length} dishes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  category === c
                    ? "bg-orange-600 text-white"
                    : "border border-canteen-200 bg-white text-slate-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={vegOnly}
              onChange={(e) => setVegOnly(e.target.checked)}
              className="rounded accent-orange-600"
            />
            Veg Only 🥦
          </label>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          {filteredDishes.map((dish) => {
            const inCart = cartItems.find((i) => i.dishId === dish.id);
            return (
              <Card key={dish.id} className="flex h-full flex-col overflow-hidden !p-0 transition-shadow hover:shadow-md">
                <FoodPhoto dish={dish} />
                <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{dish.emoji}</span>
                        <h2 className="min-w-0 font-semibold leading-5 text-ink-900">{dish.name}</h2>
                      </div>
                      <p className="mt-2 min-h-10 line-clamp-2 text-sm leading-5 text-slate-500">{dish.description}</p>
                    </div>
                    {dish.is_veg ? (
                      <Badge color="green" className="shrink-0">Veg</Badge>
                    ) : (
                      <Badge color="red" className="shrink-0">Non-Veg</Badge>
                    )}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <div>
                      <div className="text-base font-bold text-orange-600">
                        {formatINR(dish.price_paise)}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {dish.counter} Counter · {dish.prep_minutes}m prep
                      </div>
                    </div>

                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateQty(dish.id, inCart.qty - 1)}
                        >
                          -
                        </Button>
                        <span className="text-sm font-semibold">{inCart.qty}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateQty(dish.id, inCart.qty + 1)}
                          disabled={inCart.qty >= dish.stock}
                        >
                          +
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          add({
                            dishId: dish.id,
                            name: dish.name,
                            emoji: dish.emoji,
                            pricePaise: dish.price_paise,
                            isVeg: dish.is_veg,
                          })
                        }
                        disabled={dish.stock <= 0}
                      >
                        {dish.stock > 0 ? "Add +" : "Sold Out"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cart & Slot Selection Sidebar */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="border-orange-200">
          <CardContent className="p-4">
            <h2 className="mb-3 text-lg font-bold text-ink-900">Pickup slot</h2>
            {slots.length === 0 ? (
              <p className="text-sm text-red-500">
                No slots currently available. Please check back later!
              </p>
            ) : (
              <Select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
              >
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDay(s.starts_at)}: {formatTime(s.starts_at)} - {formatTime(s.ends_at)} ({s.capacity - s.booked} left)
                  </option>
                ))}
              </Select>
            )}

            <hr className="my-5 border-canteen-200" />

            <h2 className="mb-3 text-lg font-bold text-ink-900">Your tray</h2>
            {cartItems.length === 0 ? (
              <p className="rounded-lg bg-canteen-50 py-5 text-center text-sm text-slate-500">Your tray is empty</p>
            ) : (
              <div className="flex flex-col gap-3">
                {cartItems.map((item) => (
                  <div key={item.dishId} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="mr-1">{item.emoji}</span>
                      <span className="font-medium">{item.name}</span>
                      <div className="text-xs text-zinc-400">
                        {formatINR(item.pricePaise)} × {item.qty}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-xs"
                        onClick={() => updateQty(item.dishId, item.qty - 1)}
                      >
                        -
                      </Button>
                      <span>{item.qty}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-xs"
                        onClick={() => updateQty(item.dishId, item.qty + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}

                <hr className="my-2 border-canteen-200" />
                <div className="flex justify-between rounded-lg bg-canteen-50 px-3 py-3 font-bold text-ink-900">
                  <span>Total Amount</span>
                  <span className="text-orange-600">{formatINR(totalPaise)}</span>
                </div>

                <Button
                  className="mt-2 w-full"
                  disabled={ordering || slots.length === 0}
                  onClick={handleCheckout}
                >
                  {ordering ? "Placing Order…" : "Checkout Order"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
      {cartItems.length > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-4 rounded-2xl border border-orange-200 bg-white px-4 py-3 shadow-[0_12px_34px_rgba(120,75,35,0.18)] lg:hidden">
          <div>
            <p className="text-xs font-medium text-slate-500">{totalItems} item{totalItems === 1 ? "" : "s"} in your tray</p>
            <p className="text-lg font-bold text-ink-900">{formatINR(totalPaise)}</p>
          </div>
          <Button size="sm" disabled={ordering || slots.length === 0} onClick={handleCheckout}>{ordering ? "Placing..." : "Checkout"}</Button>
        </div>
      )}
    </div>
  );
}

const DISH_IMAGE_BY_ID: Record<string, string> = {
  "86c7b7d5-a3ce-4b47-8ff1-2a9c4e1bf40e": "/images/menu/masala-dosa.jpg",
  "6bb5c7f6-0e5d-4c1d-8f1e-78b040ba0a5f": "/images/menu/idli-sambar.jpg",
  "84a797eb-5c40-47b1-84ac-bd1942d7f335": "/images/menu/veg-thali.jpg",
  "dba19699-8c5e-4d31-8454-4eb6e0f3ea94": "/images/menu/paneer-butter-masala.jpg",
  "2243bbae-97e1-48c1-8396-8186a5ad0244": "/images/menu/chicken-biryani.jpg",
  "b382408c-ac44-441d-8a77-252d080ce282": "/images/menu/veg-hakka-noodles.jpg",
  "f1fb7a80-e356-4df8-892d-cc9b2313b435": "/images/menu/samosa.jpg",
  "8766d70a-3761-4a58-87f7-7a47979c4fc5": "/images/menu/vada-pav.jpg",
  "cf52ca0d-d858-471e-8a96-f484ac61e7fe": "/images/menu/gulab-jamun.jpg",
  "a33a9ec9-d261-4f5e-8658-80b4edf59a63": "/images/menu/filter-coffee.jpg",
  "7df8bc0c-85be-4534-8996-f686dfd2d755": "/images/menu/masala-chai.jpg",
  "9db4e416-ba6d-4629-88a0-c6793b19ee24": "/images/menu/mango-lassi.jpg",
};

function FoodPhoto({ dish, priority = false, className = "" }: { dish: Dish; priority?: boolean; className?: string }) {
  const imageSrc = DISH_IMAGE_BY_ID[dish.id];
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-[2] w-full shrink-0 overflow-hidden rounded-t-2xl bg-canteen-100 ${className}`}>
      {imageSrc && !failed ? (
        <Image
          src={imageSrc}
          alt={`${dish.name} served at Smart Canteen`}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-3xl" aria-label={`${dish.name} image unavailable`}>
          {dish.emoji}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-900 shadow-sm">{dish.category}</span>
    </div>
  );
}
