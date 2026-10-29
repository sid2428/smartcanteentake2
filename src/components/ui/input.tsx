"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className = "", id, ...props }, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`h-11 rounded-lg border border-canteen-200 bg-white px-3 text-sm text-ink-900 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15 disabled:bg-canteen-50 disabled:text-slate-500 ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/15" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
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
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink-900">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`h-11 rounded-lg border border-canteen-200 bg-white px-3 text-sm text-ink-900 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15 ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
