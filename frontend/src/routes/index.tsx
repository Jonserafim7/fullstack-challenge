import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { auth } from "@/lib/auth/auth";
import { GameBoard, TopBar } from "@/features/game";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    await context.auth.ensureInitialized();
    if (!context.auth.isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: Home,
});

function Home() {
  const router = useRouter();

  async function handleLogout() {
    await auth.logout();
    router.navigate({ to: "/login" });
  }

  return (
    <main className="flex min-h-screen justify-center p-3.5 sm:p-[22px]">
      <div className="flex w-full max-w-[1440px] flex-col overflow-hidden rounded-shell border border-border bg-[#0b1113] shadow-shell">
        <TopBar onLogout={handleLogout} />
        <GameBoard />
      </div>
    </main>
  );
}
