import { Logo } from "@/components/app/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="text-4xl" />
          <p className="text-muted-foreground mt-2 text-sm">
            Tus rutinas, en un solo lugar.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
