import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { auth } from "@/lib/auth/auth";
import { BalanceCard } from "@/features/wallet";
import { LiveRound, BetHistory } from "@/features/game";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Crash Game</CardTitle>
            <CardDescription>
              Bem-vindo, {auth.username ?? "jogador"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <BalanceCard />
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              Sair
            </Button>
          </CardContent>
        </Card>

        <LiveRound />

        <BetHistory />
      </div>
    </main>
  );
}
