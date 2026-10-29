"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { DishThumb, DietMark } from "@/components/dish-photo";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { formatINR } from "@/lib/domain";
import { COUNTERS } from "@/lib/domain";

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
  active: boolean;
};

const CATEGORIES = ["South Indian", "North Indian", "Chinese", "Snacks", "Beverages", "Desserts", "Thali"];

export default function OwnerDishesPage() {
  const { toast } = useToast();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ dishes: Dish[] }>("/api/owner/dishes").then((d) => setDishes(d.dishes)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createDish(form: FormData) {
    try {
      await api("/api/owner/dishes", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || "",
          category: form.get("category"),
          counter: form.get("counter"),
          pricePaise: Math.round(Number(form.get("price")) * 100),
          stock: Number(form.get("stock")),
          prepMinutes: Number(form.get("prepMinutes")) || 5,
          isVeg: form.get("isVeg") === "on",
          emoji: form.get("emoji") || "🍽️",
        }),
      });
      toast("Dish created!", "success");
      setShowForm(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create dish", "error");
    }
  }

  async function updateField(id: string, field: string, value: unknown) {
    try {
      await api(`/api/owner/dishes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      load();
    } catch {
      toast("Failed to update", "error");
    }
  }

  async function toggleActive(dish: Dish) {
    await updateField(dish.id, "active", !dish.active);
    toast(dish.active ? "Dish hidden from menu" : "Dish visible on menu", "success");
  }

  const activeCount = dishes.filter((d) => d.active).length;

  return (
    <div>
      <PageHeader
        eyebrow="Menu management"
        title={
          <>
            Dishes <span className="italic text-forest-700">&amp; stock</span>
          </>
        }
        lede={dishes.length > 0 ? `${activeCount} of ${dishes.length} dishes visible on the menu. Tap a stock number to edit it.` : undefined}
        actions={
          <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add Dish"}
          </Button>
        }
      />

      {showForm && (
        <section className="mb-14 animate-rise rounded-[2rem] bg-cream-50 p-6 shadow-soft sm:p-10">
          <h2 className="font-display text-2xl font-light text-ink">
            A new dish for the <span className="italic text-forest-700">menu</span>
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createDish(new FormData(e.currentTarget));
            }}
            className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="sm:col-span-2">
              <Input name="name" label="Name" required />
            </div>
            <div className="sm:col-span-2">
              <Input name="description" label="Description" />
            </div>
            <Select name="category" label="Category">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select name="counter" label="Counter">
              {COUNTERS.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Input name="price" label="Price (₹)" type="number" step="0.01" min="1" required />
            <Input name="stock" label="Stock" type="number" min="0" defaultValue="0" required />
            <Input name="prepMinutes" label="Prep time (min)" type="number" min="1" defaultValue="5" />
            <Input name="emoji" label="Emoji" defaultValue="🍽️" />
            <label htmlFor="isVeg" className="flex cursor-pointer items-center gap-3 self-end pb-3.5 text-sm font-medium text-ink-soft">
              <input type="checkbox" name="isVeg" id="isVeg" defaultChecked className="h-5 w-5 rounded accent-forest-600" />
              Vegetarian
            </label>
            <div className="flex items-end">
              <Button type="submit" size="lg" className="w-full">Create Dish</Button>
            </div>
          </form>
        </section>
      )}

      {dishes.length === 0 ? (
        <EmptyState icon="🍛" title="No dishes yet">
          Click &quot;+ Add Dish&quot; to get started.
        </EmptyState>
      ) : (
        <div>
          <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_0.8fr_0.8fr_1fr] gap-4 border-b border-cream-300 pb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-muted md:grid">
            <span>Dish</span>
            <span>Counter</span>
            <span>Price</span>
            <span>Stock</span>
            <span className="text-right">On menu</span>
          </div>
          <ul className="stagger">
            {dishes.map((d, i) => (
              <li
                key={d.id}
                style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-b border-cream-200 py-4 transition-opacity duration-300 md:grid-cols-[minmax(0,2.4fr)_1fr_0.8fr_0.8fr_1fr] ${
                  d.active ? "" : "opacity-55"
                }`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <DishThumb name={d.name} emoji={d.emoji} size="h-14 w-14" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display text-lg leading-tight text-ink">
                      <span className="truncate">{d.name}</span>
                      <DietMark veg={d.is_veg} className="!h-3.5 !w-3.5 after:!h-1.5 after:!w-1.5" />
                    </p>
                    <p className="text-xs text-ink-muted">{d.category}</p>
                  </div>
                </div>

                <span className="hidden text-sm text-ink-soft md:block">{d.counter}</span>
                <span className="hidden font-semibold text-ink md:block">{formatINR(d.price_paise)}</span>

                {/* Stock */}
                <div className="col-span-2 flex items-center gap-2.5 pl-[4.5rem] text-sm md:col-span-1 md:pl-0">
                  <span className="font-semibold text-ink md:hidden">{formatINR(d.price_paise)}</span>
                  <span className="text-ink-faint md:hidden">·</span>
                  <span className="text-ink-muted md:hidden">{d.counter}</span>
                  <span className="text-ink-faint md:hidden">·</span>
                  {editingId === d.id ? (
                    <input
                      type="number"
                      defaultValue={d.stock}
                      aria-label={`Stock for ${d.name}`}
                      className="h-9 w-20 rounded-xl border border-forest-500 bg-white px-3 text-sm text-ink outline-none ring-4 ring-forest-500/10"
                      onBlur={(e) => {
                        updateField(d.id, "stock", Number(e.target.value));
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateField(d.id, "stock", Number((e.target as HTMLInputElement).value));
                          setEditingId(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setEditingId(d.id)}
                      className={`group inline-flex h-9 items-center gap-1.5 rounded-xl px-3 font-semibold tabular-nums transition-colors hover:bg-cream-200 ${
                        d.stock === 0 ? "text-terra-600" : d.stock <= 10 ? "text-[#9a6b12]" : "text-ink"
                      }`}
                      title="Edit stock"
                    >
                      {d.stock}
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                        <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5Z" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <span className="whitespace-nowrap text-xs text-ink-faint md:hidden">in stock</span>
                </div>

                {/* Visibility switch */}
                <div className="col-start-2 row-start-1 flex items-center justify-end gap-3 md:col-start-auto md:row-start-auto">
                  <span className="hidden text-xs font-medium text-ink-muted sm:inline">{d.active ? "Active" : "Hidden"}</span>
                  <button
                    role="switch"
                    aria-checked={d.active}
                    aria-label={d.active ? `Hide ${d.name}` : `Show ${d.name}`}
                    onClick={() => toggleActive(d)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${d.active ? "bg-forest-500" : "bg-cream-300"}`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-[var(--ease-out-soft)] ${
                        d.active ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
