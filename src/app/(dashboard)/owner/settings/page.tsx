"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";

type Settings = {
  open_time: string;
  close_time: string;
  slot_minutes: number;
  slot_capacity: number;
  min_lead_minutes: number;
  grace_minutes: number;
  no_show_refund_percent: number;
  payment_hold_minutes: number;
};

export default function OwnerSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ settings: Settings }>("/api/owner/settings").then((d) => setSettings(d.settings)).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await api<{ settings: Settings }>("/api/owner/settings", {
        method: "PATCH",
        body: JSON.stringify({
          openTime: form.get("openTime"),
          closeTime: form.get("closeTime"),
          slotMinutes: Number(form.get("slotMinutes")),
          slotCapacity: Number(form.get("slotCapacity")),
          minLeadMinutes: Number(form.get("minLeadMinutes")),
          graceMinutes: Number(form.get("graceMinutes")),
          noShowRefundPercent: Number(form.get("noShowRefundPercent")),
          paymentHoldMinutes: Number(form.get("paymentHoldMinutes")),
        }),
      });
      setSettings(res.settings);
      toast("Settings saved!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!settings) return <p className="rounded-2xl border border-canteen-200 bg-white py-12 text-center text-slate-500">Loading...</p>;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Canteen Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="openTime" label="Opening time (IST)" type="time" defaultValue={settings.open_time?.slice(0, 5)} />
          <Input name="closeTime" label="Closing time (IST)" type="time" defaultValue={settings.close_time?.slice(0, 5)} />
          <Input name="slotMinutes" label="Slot duration (min)" type="number" min={5} max={120} defaultValue={settings.slot_minutes} />
          <Input name="slotCapacity" label="Max orders per slot" type="number" min={1} defaultValue={settings.slot_capacity} />
          <Input name="minLeadMinutes" label="Min lead time (min)" type="number" min={0} defaultValue={settings.min_lead_minutes} />
          <Input name="graceMinutes" label="Pickup grace (min)" type="number" min={0} defaultValue={settings.grace_minutes} />
          <Input name="noShowRefundPercent" label="No-show refund %" type="number" min={0} max={100} defaultValue={settings.no_show_refund_percent} />
          <Input name="paymentHoldMinutes" label="Payment hold (min)" type="number" min={1} defaultValue={settings.payment_hold_minutes} />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
