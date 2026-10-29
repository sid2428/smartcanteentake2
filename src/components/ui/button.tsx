"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-300 ease-[var(--ease-out-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 cursor-pointer";

const variants = {
  primary: "bg-forest-700 text-cream-50 shadow-[0_6px_18px_-8px_rgb(27_52_36/0.6)] hover:bg-forest-800 hover:shadow-[0_10px_24px_-10px_rgb(27_52_36/0.7)]",
  secondary: "bg-cream-200 text-forest-800 hover:bg-cream-300",
  danger: "bg-terra-500 text-cream-50 hover:bg-terra-600",
  ghost: "text-ink-soft hover:bg-cream-200 hover:text-ink",
  outline: "border border-cream-400 text-ink-soft hover:border-forest-500 hover:text-forest-700 hover:bg-cream-50",
  accent: "bg-terra-500 text-cream-50 shadow-[0_6px_18px_-8px_rgb(187_93_57/0.7)] hover:bg-terra-600",
} as const;

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...props }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
  ),
);
Button.displayName = "Button";
