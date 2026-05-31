import { createFileRoute, redirect } from "@tanstack/react-router";
import { auth } from "@/auth/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    await context.auth.ensureInitialized();
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Crash Game</CardTitle>
          <CardDescription>Entre para jogar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => auth.login()}>
            Entrar com Keycloak
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
