"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/api-client";
import { buildQrPayload, msUntilNextStep, STEP_SECONDS } from "@/lib/tickets/qr-code";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, STATUS_COLOR } from "@/components/ui/badge";
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
    return <div className="py-12 text-center text-zinc-500">Loading your tickets…</div>;
  }

  if (tickets.length === 0) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-zinc-500">No active tickets available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-6 text-2xl font-bold">Your food tickets</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Active Ticket QR Display */}
        <div>
          {activeTicket ? (
            <TicketQRCard ticket={activeTicket} />
          ) : (
            <p className="text-zinc-400">Select a ticket to display QR.</p>
          )}
        </div>

        {/* Tickets Selector List */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">All Order Tickets</h3>
          {tickets.map((t) => {
            const isSelected = activeTicket?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-orange-500 bg-orange-50"
                    : "border-canteen-200 bg-white hover:border-orange-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-2xl">{t.emoji}</span>
                    <div className="min-w-0">
                      <div className="break-words font-semibold text-zinc-900 dark:text-zinc-100">
                        {t.dish_name} <span className="text-orange-600">×{t.qty}</span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        {t.counter} Counter · Code #{t.order_code}
                      </div>
                    </div>
                  </div>
                  <Badge color={STATUS_COLOR[t.status] || "gray"}>{t.status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TicketQRCard({ ticket }: { ticket: Ticket }) {
  const [qrState, setQrState] = useState<{
    ticketId: string;
    key: string | null;
    dataUrl: string;
    error: string | null;
  }>({ ticketId: "", key: null, dataUrl: "", error: null });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(STEP_SECONDS);
  const isRedeemed = ticket.status === "REDEEMED";
  const isExpired = ticket.status === "EXPIRED" || ticket.status === "CANCELLED";
  const ticketKey = qrState.ticketId === ticket.id ? qrState.key : null;
  const qrDataUrl = qrState.ticketId === ticket.id ? qrState.dataUrl : "";
  const qrError = qrState.ticketId === ticket.id ? qrState.error : null;

  // Fetch ticket secret key
  useEffect(() => {
    const controller = new AbortController();

    if (isRedeemed || isExpired) {
      return () => controller.abort();
    }

    api<{ key: string }>(`/api/tickets/${ticket.id}/key`, { signal: controller.signal })
      .then((res) => {
        setQrState({ ticketId: ticket.id, key: res.key, dataUrl: "", error: null });
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setQrState({ ticketId: ticket.id, key: null, dataUrl: "", error: "This ticket QR code is unavailable right now." });
        }
      });
    return () => {
      controller.abort();
    };
  }, [isExpired, isRedeemed, ticket.id]);

  // Handle live 30-sec rotating QR generation
  useEffect(() => {
    if (!ticketKey) return;

    let isSubscribed = true;
    let generation = 0;

    async function updateQR() {
      if (!isSubscribed || !ticketKey) return;
      const currentGeneration = ++generation;
      const now = Date.now();
      try {
        const payload = await buildQrPayload(ticketKey, ticket.id, now);
        const dataUrl = await QRCode.toDataURL(payload, {
          margin: 4,
          width: 256,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (isSubscribed && currentGeneration === generation) {
          setQrState((current) =>
            current.ticketId === ticket.id && current.key === ticketKey
              ? { ...current, dataUrl, error: null }
              : current,
          );
        }
      } catch {
        if (isSubscribed && currentGeneration === generation) {
          setQrState((current) =>
            current.ticketId === ticket.id && current.key === ticketKey
              ? { ...current, error: "We could not generate this ticket QR code. Please try again." }
              : current,
          );
        }
      }
    }

    void updateQR();

    const interval = setInterval(() => {
      const now = Date.now();
      const msLeft = msUntilNextStep(now);
      setSecondsRemaining(Math.ceil(msLeft / 1000));
      if (msLeft > 29000 || msLeft < 1000) {
        void updateQR();
      }
    }, 1000);

    return () => {
      isSubscribed = false;
      generation += 1;
      clearInterval(interval);
    };
  }, [ticketKey, ticket.id]);

  return (
    <Card className="text-center">
      <CardContent className="p-6">
        <div className="flex items-center justify-between pb-3">
          <Badge color={STATUS_COLOR[ticket.status] || "gray"}>{ticket.status}</Badge>
          <span className="font-mono text-xs text-zinc-400">Order #{ticket.order_code}</span>
        </div>

        <div className="my-2">
          <span className="text-4xl">{ticket.emoji}</span>
          <h3 className="mt-1 text-xl font-bold">{ticket.dish_name}</h3>
          <p className="text-sm text-zinc-500">
            Qty: {ticket.qty} · Counter: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ticket.counter}</span>
          </p>
        </div>

        {/* QR Code Container */}
        <div className="my-6 flex flex-col items-center justify-center">
          {isRedeemed ? (
            <div className="flex h-56 w-56 flex-col items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <span className="text-4xl">✅</span>
              <p className="mt-2 text-sm font-semibold">Redeemed</p>
            </div>
          ) : isExpired ? (
            <div className="flex h-56 w-56 flex-col items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/20">
              <span className="text-4xl">❌</span>
              <p className="mt-2 text-sm font-semibold">Ticket Expired</p>
            </div>
          ) : qrError ? (
            <div className="flex h-56 w-56 flex-col items-center justify-center rounded-2xl bg-red-50 px-6 text-red-600">
              <p className="text-sm font-semibold">QR unavailable</p>
              <p className="mt-1 text-xs">{qrError}</p>
            </div>
          ) : qrDataUrl ? (
            <div className="relative inline-block rounded-2xl border-4 border-orange-500/20 p-2 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Dynamic QR Ticket" className="h-56 w-56 rounded-lg" />
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
                <span className="inline-block h-2 w-2 animate-ping rounded-full bg-green-500" />
                Refreshes in {secondsRemaining}s
              </div>
            </div>
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <span className="text-xs text-zinc-400">Generating QR code…</span>
            </div>
          )}
        </div>

        <div className="text-xs text-zinc-400">
          Valid until {formatDay(ticket.expires_at)} {formatTime(ticket.expires_at)}
        </div>
      </CardContent>
    </Card>
  );
}
