"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { api } from "@/lib/api-client";
import { buildQrPayload, msUntilNextStep, STEP_SECONDS } from "@/lib/tickets/qr-code";
import { Badge, STATUS_COLOR } from "@/components/ui/badge";
import { PageHeader, Loading, EmptyState } from "@/components/ui/page";
import { DishPhoto, DishThumb } from "@/components/dish-photo";
import { formatTime, formatDay } from "@/lib/domain";

type Ticket = {
  id: string;
  order_id: string;
  order_code: string;
  dish_name: string;
  emoji: string;
  counter: string;
  qty: number;
  status: string;
  expires_at: string;
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    api<{ tickets: Ticket[] }>("/api/tickets")
      .then((res) => {
        setTickets(res.tickets);
        if (res.tickets.length > 0) {
          const firstRedeemable = res.tickets.find((t) => t.status === "READY" || t.status === "ISSUED" || t.status === "PREPARING");
          setActiveTicket(firstRedeemable || res.tickets[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Loading label="Loading your tickets…" />;
  }

  if (tickets.length === 0) {
    return (
      <EmptyState icon="🎫" title="No active tickets available.">
        Tickets appear here once an order is paid.{" "}
        <Link href="/menu" className="font-semibold text-forest-700 underline-offset-4 hover:underline">
          Browse the menu
        </Link>
      </EmptyState>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pickup tickets"
        title={
          <>
            Your food <span className="italic text-forest-700">tickets</span>
          </>
        }
        lede="Show the QR at the counter. It refreshes every thirty seconds, so a screenshot won't work — keep this page open."
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[26rem_1fr] lg:gap-16">
        {/* Active Ticket QR Display */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          {activeTicket ? (
            <TicketQRCard key={activeTicket.id} ticket={activeTicket} />
          ) : (
            <p className="text-ink-muted">Select a ticket to display QR.</p>
          )}
        </div>

        {/* Tickets Selector List */}
        <section>
          <h2 className="mb-2 border-b border-cream-300 pb-3 font-display text-xl font-normal text-ink">All Order Tickets</h2>
          <ul className="stagger">
            {tickets.map((t, i) => {
              const isSelected = activeTicket?.id === t.id;
              return (
                <li key={t.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => setActiveTicket(t)}
                    aria-pressed={isSelected}
                    className={`group relative flex w-full items-center gap-4 border-b border-cream-200 py-4 pl-4 pr-2 text-left transition-all duration-300 ${
                      isSelected ? "bg-cream-50" : "hover:bg-cream-50/60"
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-forest-600 transition-transform duration-500 ${
                        isSelected ? "scale-y-100" : "scale-y-0"
                      }`}
                      aria-hidden
                    />
                    <DishThumb name={t.dish_name} emoji={t.emoji} size="h-12 w-12" eager={i < 6} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">
                        {t.dish_name} <span className="font-normal text-terra-500">×{t.qty}</span>
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {t.counter} Counter · Code #{t.order_code}
                      </span>
                    </span>
                    <Badge color={STATUS_COLOR[t.status] || "gray"}>{t.status}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function TicketQRCard({ ticket }: { ticket: Ticket }) {
  const [ticketKey, setTicketKey] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(STEP_SECONDS);

  // Fetch ticket secret key
  useEffect(() => {
    let mounted = true;
    api<{ key: string }>(`/api/tickets/${ticket.id}/key`)
      .then((res) => {
        if (mounted) setTicketKey(res.key);
      })
      .catch((err) => console.error(err));
    return () => {
      mounted = false;
    };
  }, [ticket.id]);

  // Handle live 30-sec rotating QR generation
  useEffect(() => {
    if (!ticketKey) return;

    let isSubscribed = true;

    async function updateQR() {
      if (!isSubscribed || !ticketKey) return;
      const now = Date.now();
      const payload = await buildQrPayload(ticketKey, ticket.id, now);
      const dataUrl = await QRCode.toDataURL(payload, {
        margin: 1,
        width: 320,
        color: { dark: "#13261a", light: "#ffffff" },
      });
      if (isSubscribed) {
        setQrDataUrl(dataUrl);
      }
    }

    updateQR();

    const interval = setInterval(() => {
      const now = Date.now();
      const msLeft = msUntilNextStep(now);
      setSecondsRemaining(Math.ceil(msLeft / 1000));
      if (msLeft > 29000 || msLeft < 1000) {
        updateQR();
      }
    }, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [ticketKey, ticket.id]);

  const isRedeemed = ticket.status === "REDEEMED";
  const isExpired = ticket.status === "EXPIRED" || ticket.status === "CANCELLED";

  const r = 15;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, secondsRemaining / STEP_SECONDS));

  return (
    <article className="animate-pop overflow-hidden rounded-[2rem] bg-cream-50 shadow-lift">
      {/* Photo header */}
      <div className="relative h-36 overflow-hidden">
        <DishPhoto name={ticket.dish_name} emoji={ticket.emoji} sizes="420px" eager />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/80 via-forest-900/20 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <Badge color={STATUS_COLOR[ticket.status] || "gray"} className="!bg-cream-50/95">
            {ticket.status}
          </Badge>
          <span className="rounded-full bg-forest-900/50 px-2.5 py-1 font-mono text-[0.7rem] text-cream-100 backdrop-blur">
            Order #{ticket.order_code}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-4">
          <h3 className="font-display text-2xl font-normal text-cream-50">{ticket.dish_name}</h3>
          <p className="text-sm text-cream-200">
            Qty: {ticket.qty} · Counter: <span className="font-semibold text-cream-50">{ticket.counter}</span>
          </p>
        </div>
      </div>

      {/* QR Code Container */}
      <div className="flex flex-col items-center px-6 pb-6 pt-8">
        {isRedeemed ? (
          <div className="flex aspect-square w-full max-w-[16rem] flex-col items-center justify-center rounded-3xl bg-cream-200 text-ink-muted">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-600 text-cream-50">
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="m5 10.5 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="mt-4 font-display text-xl text-ink">Redeemed</p>
            <p className="text-xs">Enjoy your meal</p>
          </div>
        ) : isExpired ? (
          <div className="flex aspect-square w-full max-w-[16rem] flex-col items-center justify-center rounded-3xl bg-terra-50 text-terra-600">
            <span className="text-4xl" aria-hidden>⌛</span>
            <p className="mt-4 font-display text-xl">Ticket Expired</p>
          </div>
        ) : qrDataUrl ? (
          <>
            <div className="rounded-3xl bg-white p-3 shadow-[inset_0_0_0_1px_var(--color-cream-200)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={qrDataUrl} src={qrDataUrl} alt="Dynamic QR Ticket" className="aspect-square w-full max-w-[15rem] animate-fade rounded-xl" />
            </div>
            <div className="mt-5 flex items-center gap-3 text-sm text-ink-muted">
              <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-cream-300)" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r={r}
                  fill="none"
                  stroke="var(--color-forest-500)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              <span>
                Refreshes in <span className="font-semibold tabular-nums text-ink">{secondsRemaining}s</span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex aspect-square w-full max-w-[16rem] items-center justify-center rounded-3xl bg-cream-200">
            <span className="animate-pulse text-xs text-ink-muted">Generating QR code…</span>
          </div>
        )}
      </div>

      {/* Perforation */}
      <div className="relative flex items-center" aria-hidden>
        <span className="absolute -left-3 h-6 w-6 rounded-full bg-cream-100" />
        <span className="mx-5 h-px flex-1 border-t-2 border-dashed border-cream-300" />
        <span className="absolute -right-3 h-6 w-6 rounded-full bg-cream-100" />
      </div>

      <div className="flex items-center justify-between px-6 py-5 text-xs text-ink-muted">
        <span>Valid until</span>
        <span className="font-semibold text-ink-soft">
          {formatDay(ticket.expires_at)} {formatTime(ticket.expires_at)}
        </span>
      </div>
    </article>
  );
}
