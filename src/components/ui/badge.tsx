import type { HTMLAttributes } from "react";

const colors = {
  gray: "bg-cream-200 text-ink-soft",
  orange: "bg-terra-100 text-terra-700",
  green: "bg-forest-100 text-forest-700",
  red: "bg-terra-50 text-terra-600 ring-1 ring-inset ring-terra-200",
  blue: "bg-[#e6ecef] text-[#35505f]",
  yellow: "bg-[#f6e9c9] text-[#7a5a17]",
  purple: "bg-[#ece4ef] text-[#5c4366]",
} as const;

const dots = {
  gray: "bg-ink-faint",
  orange: "bg-terra-500",
  green: "bg-forest-500",
  red: "bg-terra-500",
  blue: "bg-[#5a7b8c]",
  yellow: "bg-[#c9952c]",
  purple: "bg-[#8a6a96]",
} as const;

export type BadgeColor = keyof typeof colors;

export function Badge({
  color = "gray",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color?: BadgeColor }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide ${colors[color]} ${className}`}
      {...props}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[color]}`} aria-hidden />
      {typeof children === "string" ? statusLabel(children) : children}
    </span>
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

const STATUS_LABEL: Record<string, string> = {
  ISSUED: "Issued",
  PREPARING: "Preparing",
  READY: "Ready",
  REDEEMED: "Collected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PAYMENT_FAILED: "Payment failed",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

/** Human-friendly label for a raw status code; other strings pass through. */
export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
