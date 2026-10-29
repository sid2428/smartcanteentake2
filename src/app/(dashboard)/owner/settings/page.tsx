"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Loading } from "@/components/ui/page";
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

  if (!settings) return <Loading />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Configuration"
        title={
          <>
            Canteen <span className="italic text-forest-700">settings</span>
          </>
        }
        lede="How your day runs: when you open, how pickup slots fill, and what happens when food isn't collected."
      />

      <form onSubmit={onSubmit} className="animate-rise border-t border-cream-300">
        <Group title="Opening hours" description="All times are in IST. Slots are generated between these hours.">
          <Input name="openTime" label="Opening time (IST)" type="time" defaultValue={settings.open_time?.slice(0, 5)} />
          <Input name="closeTime" label="Closing time (IST)" type="time" defaultValue={settings.close_time?.slice(0, 5)} />
        </Group>

        <Group title="Pickup slots" description="Slot length, how many orders each slot takes, and how far ahead students must order.">
          <Input name="slotMinutes" label="Slot duration (min)" type="number" min={5} max={120} defaultValue={settings.slot_minutes} />
          <Input name="slotCapacity" label="Max orders per slot" type="number" min={1} defaultValue={settings.slot_capacity} />
          <Input name="minLeadMinutes" label="Min lead time (min)" type="number" min={0} defaultValue={settings.min_lead_minutes} />
        </Group>

        <Group title="Payments & no-shows" description="How long unpaid orders are held, and the refund when ready food isn't picked up.">
          <Input name="paymentHoldMinutes" label="Payment hold (min)" type="number" min={1} defaultValue={settings.payment_hold_minutes} />
          <Input name="graceMinutes" label="Pickup grace (min)" type="number" min={0} defaultValue={settings.grace_minutes} />
          <Input name="noShowRefundPercent" label="No-show refund %" type="number" min={0} max={100} defaultValue={settings.no_show_refund_percent} />
        </Group>

        <div className="flex justify-end pt-8">
          <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto sm:min-w-48">
            {loading ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Group({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-6 border-b border-cream-300 py-10 md:grid-cols-[16rem_1fr] md:gap-12">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="font-display text-xl font-normal text-ink" aria-hidden>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
