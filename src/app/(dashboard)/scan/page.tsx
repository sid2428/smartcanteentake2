"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
import { useToast } from "@/components/ui/toast";

type RedeemedTicket = {
  id: string;
  dish_name: string;
  qty: number;
  counter: string;
};

export default function ScanPage() {
  const { toast } = useToast();
  const [lastRedeemed, setLastRedeemed] = useState<RedeemedTicket | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [processing, setProcessing] = useState(false);
  // The scanner fires ~10 times a second while a code is in view, so in-flight state lives
  // in a ref (the camera callback is registered once and would otherwise see stale state).
  const processingRef = useRef(false);
  const lastPayloadRef = useRef<{ payload: string; at: number } | null>(null);

  async function handleRedeem(payload: string) {
    const now = Date.now();
    const last = lastPayloadRef.current;
    if (processingRef.current || (last && last.payload === payload && now - last.at < 5000)) return;
    processingRef.current = true;
    lastPayloadRef.current = { payload, at: now };
    setProcessing(true);
    setErrorMsg(null);

    try {
      const res = await api<{ ok: boolean; ticket: RedeemedTicket }>("/api/scan", {
        method: "POST",
        body: JSON.stringify({ payload }),
      });
      setLastRedeemed(res.ticket);
      toast(`Redeemed: ${res.ticket.dish_name} × ${res.ticket.qty}`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to redeem QR ticket";
      setLastRedeemed(null);
      setErrorMsg(message);
      toast(message, "error");
    } finally {
      setTimeout(() => {
        processingRef.current = false;
        setProcessing(false);
      }, 1500);
    }
  }

  const handleRedeemRef = useRef(handleRedeem);
  useEffect(() => {
    handleRedeemRef.current = handleRedeem;
  });

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        void handleRedeemRef.current(decodedText);
      },
      () => {
        // Per-frame "no QR found" errors are expected; ignore them.
      }
    );

    return () => {
      scanner.clear().catch((err) => console.error("Error clearing scanner", err));
    };
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Counter"
        title={
          <>
            Ticket <span className="italic text-forest-700">scanner</span>
          </>
        }
        lede="Scan student rotating QR codes to fulfill orders. Each ticket can be redeemed once."
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
        {/* Camera */}
        <section className="animate-rise">
          <div className="relative overflow-hidden rounded-[2rem] bg-forest-900 p-4 shadow-lift sm:p-6">
            <div className="mb-4 flex items-center justify-between px-1 text-xs text-forest-200">
              <span className="inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${processing ? "animate-pulse bg-terra-300" : "bg-forest-400"}`} />
                {processing ? "Verifying…" : "Ready to scan"}
              </span>
              <span className="font-display italic text-forest-300">Hold the QR inside the frame</span>
            </div>
            <div id="qr-reader" className="overflow-hidden rounded-2xl" />
          </div>
        </section>

        {/* Result + manual entry */}
        <aside className="flex flex-col gap-8">
          <div className="min-h-[14rem]">
            {lastRedeemed ? (
              <div key={lastRedeemed.id} className="animate-pop rounded-[2rem] bg-forest-50 p-7 ring-1 ring-inset ring-forest-100">
                <div className="flex items-center gap-4">
                  <DishThumb name={lastRedeemed.dish_name} size="h-16 w-16" />
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-600 text-cream-50" aria-hidden>
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m5 10.5 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                <p className="eyebrow mt-6 !text-forest-600">Verified · Dispense now</p>
                <h3 className="mt-2 font-display text-3xl font-light leading-tight text-forest-900">
                  {lastRedeemed.qty} × {lastRedeemed.dish_name}
                </h3>
                <p className="mt-3 text-sm text-forest-700">
                  Counter: {lastRedeemed.counter} · Ticket #{lastRedeemed.id.slice(0, 8)} verified and redeemed!
                </p>
              </div>
            ) : errorMsg ? (
              <div className="animate-pop rounded-[2rem] bg-terra-50 p-7 ring-1 ring-inset ring-terra-100">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-terra-500 text-cream-50" aria-hidden>
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" />
                  </svg>
                </span>
                <p className="eyebrow mt-6">Not redeemed</p>
                <p className="mt-2 font-display text-2xl font-light text-terra-700">{errorMsg}</p>
              </div>
            ) : (
              <div className="flex h-full min-h-[14rem] flex-col justify-center rounded-[2rem] border border-dashed border-cream-400 p-7 text-center">
                <p className="font-display text-xl font-light text-ink-soft">Waiting for a ticket</p>
                <p className="mt-2 text-sm text-ink-muted">Results of each scan appear here.</p>
              </div>
            )}
          </div>

          {/* Manual Input Fallback */}
          <div>
            <h4 className="mb-1 font-display text-lg text-ink">Manual Code Entry</h4>
            <p className="mb-4 text-xs text-ink-muted">If the camera is unavailable, paste the raw QR payload.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode) handleRedeem(manualCode);
              }}
              className="flex flex-col gap-3 sm:flex-row lg:flex-col"
            >
              <input
                type="text"
                placeholder="Paste raw QR token payload..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                aria-label="QR token payload"
                className="h-12 flex-1 rounded-2xl border border-cream-300 bg-cream-50 px-4 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-forest-500/10"
              />
              <Button type="submit" size="lg" disabled={processing || !manualCode}>
                Redeem
              </Button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
