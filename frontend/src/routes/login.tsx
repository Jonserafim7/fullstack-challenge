import { createFileRoute, redirect } from "@tanstack/react-router";
import { LogInIcon, RocketIcon } from "lucide-react";
import { auth } from "@/lib/auth/auth";

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
    <main
      className="grid min-h-screen place-items-center p-6"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, rgb(132 255 52 / 0.1), transparent 45%), var(--background)",
      }}
    >
      <div className="w-full max-w-[400px] rounded-panel border border-border bg-card/90 px-[30px] py-9 text-center shadow-shell">
        <div className="mx-auto mb-[18px] grid size-16 place-items-center rounded-full border-4 border-primary bg-[#16221c] text-primary shadow-[0_8px_20px_-8px_rgb(132_255_52_/_0.3)]">
          <RocketIcon className="size-8" strokeWidth={1.5} />
        </div>
        <h1 className="text-[26px] font-black text-white">Crash Game</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre para jogar a próxima rodada.
        </p>

        <div className="my-[22px] flex justify-center gap-2">
          <span className="rounded-full bg-destructive/15 px-3 py-1.5 text-[13px] font-black text-destructive tabular-nums">
            1.12x
          </span>
          <span className="rounded-full bg-success/15 px-3 py-1.5 text-[13px] font-black text-success tabular-nums">
            2.41x
          </span>
          <span className="rounded-full bg-warning/20 px-3 py-1.5 text-[13px] font-black text-warning tabular-nums">
            12.9x
          </span>
          <span className="rounded-full bg-success/15 px-3 py-1.5 text-[13px] font-black text-success tabular-nums">
            3.72x
          </span>
        </div>

        <button
          type="button"
          onClick={() => auth.login()}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-primary text-[15px] font-black text-primary-foreground shadow-glow-lime transition-[transform,background] hover:bg-primary/90 active:translate-y-px"
        >
          <LogInIcon className="size-[18px] -mt-0.5" />
          Entrar com Keycloak
        </button>
        <p className="mt-4 text-[11px] text-muted-foreground/70">
          Você é redirecionado ao provedor (OIDC) e volta autenticado.
        </p>
      </div>
    </main>
  );
}
