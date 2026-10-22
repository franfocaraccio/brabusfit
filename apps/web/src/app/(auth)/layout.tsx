import { Logo } from "@/components/app/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Brillo de la marca detrás del logo. */}
      <div
        aria-hidden
        className="bg-primary/25 pointer-events-none absolute top-[-13rem] left-1/2 h-[28rem] w-[30rem] -translate-x-1/2 rounded-full blur-[100px]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <Logo className="text-3xl" />
          <p className="text-muted-foreground mt-2 text-sm">Tu entrenamiento, en un solo lugar</p>
        </div>
        {children}
      </div>
    </div>
  );
}
