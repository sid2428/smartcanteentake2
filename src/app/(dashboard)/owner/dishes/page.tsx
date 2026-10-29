"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div>
      <CardHeader className="mb-5">
        <CardTitle>Dish Management</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add Dish"}
        </Button>
      </CardHeader>

      {showForm && (
        <Card className="mb-6 border-orange-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createDish(new FormData(e.currentTarget));
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <Input name="name" label="Name" required />
            <Input name="description" label="Description" />
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
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" name="isVeg" id="isVeg" defaultChecked />
              <label htmlFor="isVeg" className="text-sm">Vegetarian</label>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Create Dish</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-canteen-200 text-slate-500">
              <th className="py-3 pr-3">Dish</th>
              <th className="py-3 pr-3">Category</th>
              <th className="py-3 pr-3">Counter</th>
              <th className="py-3 pr-3">Price</th>
              <th className="py-3 pr-3">Stock</th>
              <th className="py-3 pr-3">Status</th>
              <th className="py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((d) => (
              <tr key={d.id} className="border-b border-canteen-100 hover:bg-canteen-50">
                <td className="py-3 pr-3 font-medium">
                  {d.emoji} {d.name}
                  {d.is_veg && <span className="ml-1 text-green-600">●</span>}
                </td>
                <td className="py-3 pr-3">{d.category}</td>
                <td className="py-3 pr-3">{d.counter}</td>
                <td className="py-3 pr-3">{formatINR(d.price_paise)}</td>
                <td className="py-3 pr-3">
                  {editingId === d.id ? (
                    <input
                      type="number"
                      defaultValue={d.stock}
                      className="w-20 rounded border px-2 py-1 text-sm"
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
                    <button onClick={() => setEditingId(d.id)} className="hover:underline">
                      {d.stock}
                    </button>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <Badge color={d.active ? "green" : "gray"}>{d.active ? "Active" : "Hidden"}</Badge>
                </td>
                <td className="py-3">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                    {d.active ? "Hide" : "Show"}
                  </Button>
                </td>
              </tr>
            ))}
            {dishes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-400">
                  No dishes yet. Click &quot;+ Add Dish&quot; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
