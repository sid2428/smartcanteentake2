import type { HTMLAttributes } from "react";

const colors = {
  gray: "bg-slate-100 text-slate-700",
  orange: "bg-orange-100 text-orange-800",
  green: "bg-veg-50 text-veg-700",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  yellow: "bg-amber-100 text-amber-800",
  purple: "bg-purple-100 text-purple-800",
} as const;

export type BadgeColor = keyof typeof colors;

export function Badge({
  color = "gray",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color?: BadgeColor }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]} ${className}`}
      {...props}
    />
  );
}

/** Map ticket/order statuses to badge colors. */
export const STATUS_COLOR: Record<string, BadgeColor> = {
  ISSUED: "blue",
  PREPARING: "yellow",
  READY: "green",
  REDEEMED: "gray",
  EXPIRED: "red",
  CANCELLED: "red",
  PENDING_PAYMENT: "orange",
  PAID: "blue",
  PAYMENT_FAILED: "red",
  COMPLETED: "green",
  CLOSED: "gray",
};
