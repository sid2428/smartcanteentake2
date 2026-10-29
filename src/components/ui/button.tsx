"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary: "bg-orange-500 text-white shadow-sm hover:bg-orange-600 active:bg-orange-700",
  secondary: "bg-canteen-100 text-ink-900 hover:bg-canteen-200 active:bg-orange-100",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
  ghost: "text-slate-500 hover:bg-canteen-100 hover:text-ink-900 active:bg-canteen-200",
  outline: "border border-canteen-200 bg-white text-ink-900 hover:border-orange-300 hover:bg-canteen-50 active:bg-orange-100",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
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
