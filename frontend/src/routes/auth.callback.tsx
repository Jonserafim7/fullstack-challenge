import { useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { auth } from "@/auth/auth";

export const Route = createFileRoute("/auth/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    auth
      .completeLogin()
      .then(() => router.navigate({ to: "/" }))
      .catch(() => router.navigate({ to: "/login" }));
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center">
      <p className="text-muted-foreground">Finalizando login…</p>
    </main>
  );
}
