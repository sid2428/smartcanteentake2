import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { releaseUnpaidOrder } from "@/lib/server/sweeps";

/** POST /api/orders/[id]/cancel - student or staff cancels an unpaid order */
export const POST = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("student", "staff", "owner");
  const { id } = await params;

  await withTransaction(async (tx) => {
    const order = await tx.queryOne<{ id: string; user_id: string; slot_id: string; status: string }>(
      "SELECT id, user_id, slot_id, status FROM orders WHERE id = $1 FOR UPDATE",
      [id],
    );

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    if (session.role === "student" && order.user_id !== session.uid) {
      throw new HttpError(403, "Access denied");
    }

    // Cancelling twice (double tap) is harmless.
    if (order.status === "PAYMENT_FAILED") return;

    if (order.status !== "PENDING_PAYMENT") {
      throw new HttpError(
        409,
        "This order is already paid, so it can't be cancelled here. Please speak to the counter.",
        "NOT_CANCELLABLE",
      );
    }

    await releaseUnpaidOrder(tx, order);
  });

  return NextResponse.json({ ok: true });
});
