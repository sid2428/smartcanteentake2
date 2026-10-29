"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

const field =
  "h-12 w-full rounded-2xl border border-cream-300 bg-cream-50 px-4 text-[0.95rem] text-ink placeholder:text-ink-faint transition-all duration-200 hover:border-cream-400 focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-forest-500/10 disabled:opacity-60";

const labelClass = "text-[0.8rem] font-semibold text-ink-soft";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className = "", id, ...props }, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className={labelClass}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`${field} ${error ? "border-terra-400 focus:border-terra-500 focus:ring-terra-500/10" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-terra-600">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = "", id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={selectId} className={labelClass}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`${field} cursor-pointer appearance-none pr-11 ${className}`}
            {...props}
          >
            {children}
          </select>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {error && <p className="text-xs text-terra-600">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
