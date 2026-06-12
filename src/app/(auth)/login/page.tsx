import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check_email?: string; error?: string }>;
}) {
  const { check_email, error } = await searchParams;

  const errorMessage =
    error === "confirm"
      ? "El link de confirmación venció o ya se usó. Iniciá sesión o registrate de nuevo."
      : error
        ? "Hubo un problema al iniciar sesión. Probá de nuevo."
        : null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {check_email ? (
          <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            Te enviamos un email para confirmar tu cuenta. Revisá tu casilla.
          </p>
        ) : null}
        {errorMessage ? (
          <p className="text-destructive text-sm">{errorMessage}</p>
        ) : null}

        <GoogleButton />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">o</span>
          <Separator className="flex-1" />
        </div>

        <LoginForm />
      </CardContent>
    </Card>
  );
}
