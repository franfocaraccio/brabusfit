"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  CLIENT_GOALS,
  CLIENT_LEVELS,
  CLIENT_SEXES,
  EMPTY_CLIENT,
  displayDateError,
  formatDisplayDate,
  maskDisplayDate,
  parseDisplayDate,
  type ClientInput,
} from "@brabus/shared";

import { saveClient } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE = "__none__";

function OptionSelect<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T | "") => void;
}) {
  const items = { [NONE]: "Sin dato", ...Object.fromEntries(options.map((o) => [o.value, o.label])) };
  return (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(!v || v === NONE ? "" : (v as T))}
      items={items}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sin dato</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Alta / edición de la ficha de un cliente. */
export function ClientForm({
  clientId,
  initial,
  emailLocked = false,
}: {
  clientId?: string;
  initial?: ClientInput;
  /** Con la app vinculada (o invitado) el email es el de su cuenta. */
  emailLocked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<ClientInput>(initial ?? EMPTY_CLIENT);
  const [birth, setBirth] = useState(formatDisplayDate(initial?.birth_date));

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const birthError = displayDateError(birth);
    if (birthError) {
      toast.error(`Fecha de nacimiento: ${birthError}`);
      return;
    }
    const payload = { ...data, birth_date: parseDisplayDate(birth) ?? "" };
    startTransition(async () => {
      const result = await saveClient(clientId ?? null, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(clientId ? "Ficha actualizada" : "Cliente creado");
      router.push(`/clientes/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <Field id="first_name" label="Nombre *">
            <Input
              id="first_name"
              value={data.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              autoFocus={!clientId}
            />
          </Field>
          <Field id="last_name" label="Apellido">
            <Input id="last_name" value={data.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
          <Field id="phone" label="Teléfono / WhatsApp">
            <Input
              id="phone"
              type="tel"
              value={data.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+54 9 11 1234-5678"
            />
          </Field>
          <Field
            id="email"
            label="Email"
            hint={emailLocked ? "Es el de su cuenta en la app." : undefined}
          >
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={emailLocked}
              autoCapitalize="none"
            />
          </Field>
          <Field id="birth_date" label="Fecha de nacimiento">
            <Input
              id="birth_date"
              inputMode="numeric"
              value={birth}
              onChange={(e) => setBirth(maskDisplayDate(e.target.value))}
              placeholder="DD/MM/AAAA"
            />
          </Field>
          <Field id="sex" label="Sexo">
            <OptionSelect id="sex" value={data.sex} options={CLIENT_SEXES} onChange={(v) => set("sex", v)} />
          </Field>
          <Field id="height_cm" label="Estatura (cm)">
            <Input
              id="height_cm"
              inputMode="decimal"
              value={data.height_cm}
              onChange={(e) => set("height_cm", e.target.value)}
              placeholder="170"
            />
          </Field>
          <Field id="initial_weight_kg" label="Peso inicial (kg)">
            <Input
              id="initial_weight_kg"
              inputMode="decimal"
              value={data.initial_weight_kg}
              onChange={(e) => set("initial_weight_kg", e.target.value)}
              placeholder="70,5"
            />
          </Field>
          <Field id="goal" label="Objetivo">
            <OptionSelect id="goal" value={data.goal} options={CLIENT_GOALS} onChange={(v) => set("goal", v)} />
          </Field>
          <Field id="level" label="Nivel">
            <OptionSelect id="level" value={data.level} options={CLIENT_LEVELS} onChange={(v) => set("level", v)} />
          </Field>
          <Field id="injuries" label="Lesiones / patologías" className="sm:col-span-2">
            <Textarea
              id="injuries"
              value={data.injuries}
              onChange={(e) => set("injuries", e.target.value)}
              placeholder="Ej: dolor lumbar, operado de rodilla…"
            />
          </Field>
          <Field
            id="notes"
            label="Notas privadas"
            hint="Solo las ves vos, aunque use la app."
            className="sm:col-span-2"
          >
            <Textarea id="notes" value={data.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : clientId ? "Guardar cambios" : "Crear cliente"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
