"use client";

import { useActionState, useState } from "react";

import { completeProfile, type ProfileResult } from "@/lib/actions/profile";
import type { Profile } from "@/lib/supabase/types";
import { UsernameField } from "@/components/auth/username-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompleteProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState<ProfileResult, FormData>(
    completeProfile,
    undefined,
  );
  const [usernameValid, setUsernameValid] = useState(
    Boolean(profile.username),
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="first_name">Nombre</Label>
          <Input
            id="first_name"
            name="first_name"
            required
            defaultValue={profile.first_name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Apellido</Label>
          <Input
            id="last_name"
            name="last_name"
            required
            defaultValue={profile.last_name}
          />
        </div>
      </div>

      <UsernameField
        defaultValue={profile.username ?? ""}
        onValidChange={setUsernameValid}
      />

      <div className="space-y-2">
        <Label htmlFor="birth_date">Fecha de nacimiento</Label>
        <Input
          id="birth_date"
          name="birth_date"
          type="date"
          defaultValue={profile.birth_date ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="height_cm">Altura (cm)</Label>
          <DecimalInput
            id="height_cm"
            name="height_cm"
            placeholder="175"
            defaultValue={profile.height_cm ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight_kg">Peso (kg)</Label>
          <DecimalInput
            id="weight_kg"
            name="weight_kg"
            placeholder="70"
            defaultValue={profile.weight_kg ?? ""}
          />
        </div>
      </div>

      <div className="bg-muted/40 flex items-start gap-3 rounded-xl border p-3">
        <Checkbox
          id="is_coach"
          name="is_coach"
          className="mt-0.5"
          defaultChecked={profile.is_coach}
        />
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
        {pending ? "Guardando…" : "Guardar y continuar"}
      </Button>
    </form>
  );
}
