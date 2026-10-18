"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/actions/profile";
import type { Profile } from "@brabus/shared";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? "");
  const [heightCm, setHeightCm] = useState(profile.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(profile.weight_kg?.toString() ?? "");

  const submit = () => {
    startTransition(async () => {
      const res = await updateProfile({
        firstName,
        lastName,
        birthDate: birthDate || null,
        heightCm,
        weightKg,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Perfil actualizado");
      router.refresh();
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="first_name">Nombre</Label>
          <Input
            id="first_name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Apellido</Label>
          <Input
            id="last_name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="birth_date">Fecha de nacimiento</Label>
        <Input
          id="birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="height_cm">Altura (cm)</Label>
          <DecimalInput
            id="height_cm"
            placeholder="175"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight_kg">Peso (kg)</Label>
          <DecimalInput
            id="weight_kg"
            placeholder="70"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
