"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { sanitizeDecimal } from "@/lib/decimal";

/**
 * Input para números decimales que acepta coma o punto (teclados en español).
 * Funciona controlado (value + onChange) o no controlado (defaultValue + name).
 */
export function DecimalInput({
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "inputMode">) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      onChange={(e) => {
        const clean = sanitizeDecimal(e.target.value);
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }}
    />
  );
}
