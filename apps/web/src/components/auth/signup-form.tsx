"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signUpAction, type AuthResult } from "@/lib/actions/auth";
import { UsernameField } from "@/components/auth/username-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    signUpAction,
    undefined,
  );
  const [usernameValid, setUsernameValid] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="first_name">Nombre</Label>
          <Input id="first_name" name="first_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Apellido</Label>
          <Input id="last_name" name="last_name" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="birth_date">Fecha de nacimiento</Label>
        <Input id="birth_date" name="birth_date" type="date" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="height_cm">Altura (cm)</Label>
          <DecimalInput
            id="height_cm"
            name="height_cm"
            placeholder="175"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight_kg">Peso (kg)</Label>
          <DecimalInput
            id="weight_kg"
            name="weight_kg"
            placeholder="70"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@email.com"
        />
      </div>

      <UsernameField onValidChange={setUsernameValid} />

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>

      <div className="bg-muted/40 flex items-start gap-3 rounded-md border p-3">
        <Checkbox id="is_coach" name="is_coach" className="mt-0.5" />
        <div className="grid gap-1 leading-none">
          <Label htmlFor="is_coach">Soy coach</Label>
          <p className="text-muted-foreground text-xs">
            Vas a poder crear rutinas y compartirlas con tus alumnos.
          </p>
        </div>
      </div>

      {state?.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={pending || !usernameValid}
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-primary font-medium underline">
          Ingresar
        </Link>
      </p>
    </form>
  );
}
