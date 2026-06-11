"use client";

import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" className="gap-2">
        <LogOut className="size-4" />
        <span className="hidden sm:inline">Salir</span>
      </Button>
    </form>
  );
}
