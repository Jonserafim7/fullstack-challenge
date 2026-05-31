import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { auth } from "@/auth/auth";
import { useBalanceQuery } from "@/queries/balance";
import { formatCents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data, isPending, isError } = useBalanceQuery();

  async function handleLogout() {
    await auth.logout();
    router.navigate({ to: "/login" });
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Crash Game</CardTitle>
          <CardDescription>
            Bem-vindo, {auth.username ?? "jogador"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Saldo</p>
            {isPending ? (
              <Skeleton className="h-9 w-36" />
            ) : isError ? (
              <p className="text-sm text-destructive">
                Não foi possível carregar o saldo.
              </p>
            ) : (
              <p className="text-3xl font-semibold tabular-nums">
                {formatCents(data.balance)}
              </p>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Sair
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
