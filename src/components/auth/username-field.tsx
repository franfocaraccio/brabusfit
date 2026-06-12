"use client";

import { useEffect, useState } from "react";

import { checkUsername } from "@/lib/actions/profile";
import { usernameError } from "@/lib/username";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Campo de nombre de usuario con validación de formato + disponibilidad en vivo.
 * Reporta al padre si es válido (formato ok y disponible) vía onValidChange.
 * El input lleva name="username" para que entre en el FormData del form.
 */
export function UsernameField({
  defaultValue = "",
  onValidChange,
}: {
  defaultValue?: string;
  onValidChange: (valid: boolean) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!value || usernameError(value)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await checkUsername(value);
      if (!cancelled) {
        setStatus(res.available ? "available" : "taken");
        onValidChange(res.available);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, onValidChange]);

  const onChange = (raw: string) => {
    const v = raw.toLowerCase();
    setValue(v);
    if (v === "") {
      setStatus("idle");
      onValidChange(false);
      return;
    }
    if (usernameError(v)) {
      setStatus("invalid");
      onValidChange(false);
      return;
    }
    setStatus("checking");
    onValidChange(false);
  };

  const msg: { text: string; cls: string } | null =
    status === "invalid"
      ? { text: usernameError(value) ?? "", cls: "text-destructive" }
      : status === "checking"
        ? { text: "Verificando…", cls: "text-muted-foreground" }
        : status === "available"
          ? { text: "Disponible", cls: "text-emerald-500" }
          : status === "taken"
            ? { text: "Ya está en uso.", cls: "text-destructive" }
            : null;

  return (
    <div className="space-y-2">
      <Label htmlFor="username">Nombre de usuario</Label>
      <Input
        id="username"
        name="username"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="juan.perez"
        autoCapitalize="none"
        autoComplete="off"
        aria-invalid={status === "invalid" || status === "taken"}
        required
      />
      {msg ? <p className={`text-xs ${msg.cls}`}>{msg.text}</p> : null}
    </div>
  );
}
