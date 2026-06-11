import { AppNav } from "@/components/app/app-nav";
import { Logo } from "@/components/app/logo";
import { LogoutButton } from "@/components/app/logout-button";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();

  return (
    <div className="flex min-h-dvh">
      <AppNav isCoach={profile.is_coach} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:px-6">
          <Logo className="text-lg md:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {profile.first_name} {profile.last_name}
              {profile.is_coach ? " · Coach" : ""}
            </span>
            <LogoutButton />
          </div>
        </header>

        {/* pb extra en mobile para no tapar contenido con la bottom nav */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
