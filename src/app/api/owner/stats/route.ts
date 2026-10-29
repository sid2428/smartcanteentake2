import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query, queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";

/** GET /api/owner/stats - canteen dashboard analytics */
export const GET = handle(async () => {
  await requireRole("owner");

  const todaySummary = await queryOne<{
    total_orders: string;
    total_revenue_paise: string;
  }>(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_paise), 0) as total_revenue_paise
    FROM orders
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' AND status IN ('PAID', 'COMPLETED', 'CLOSED')
  `);

  const ticketsSummary = await queryOne<{
    redeemed: string;
    active: string;
    expired: string;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'REDEEMED') as redeemed,
      COUNT(*) FILTER (WHERE status IN ('ISSUED', 'PREPARING', 'READY')) as active,
      COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired
    FROM tickets
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
  `);

  const topDishes = await query<{
    dish_name: string;
    total_qty: string;
    total_paise: string;
  }>(`
    SELECT 
      dish_name, 
      SUM(qty) as total_qty, 
      SUM(amount_paise) as total_paise
    FROM tickets
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' AND status != 'CANCELLED'
    GROUP BY dish_name
    ORDER BY total_qty DESC
    LIMIT 5
  `);

  return NextResponse.json({
    today: {
      ordersCount: parseInt(todaySummary?.total_orders || "0", 10),
      revenuePaise: parseInt(todaySummary?.total_revenue_paise || "0", 10),
      ticketsRedeemed: parseInt(ticketsSummary?.redeemed || "0", 10),
      ticketsActive: parseInt(ticketsSummary?.active || "0", 10),
      ticketsExpired: parseInt(ticketsSummary?.expired || "0", 10),
    },
    topDishes,
  });
});
