import { useEffect, useRef, useState } from "react";
import { LogOutIcon, RocketIcon, UserIcon, WalletIcon } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { useBalanceQuery } from "@/features/wallet";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// The app-shell header and the only place the balance lives (README "saldo em destaque"): a prominent
// lime pill that bumps when a cash-out credit lands. Brand mark on the left, balance + username +
// logout on the right.
export function TopBar({ onLogout }: { onLogout: () => void }) {
  const { data, isPending } = useBalanceQuery();
  const balance = data?.balance ?? null;
  const bump = useBalanceBump(balance);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[#141a1f]/95 px-[18px] py-3.5">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full border-4 border-primary bg-[#16221c] text-primary shadow-[0_8px_20px_-8px_rgb(132_255_52_/_0.3)]">
          <RocketIcon className="size-5" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[15px] leading-none font-black text-white">
            Crash Game
          </p>
          <p className="mt-1 text-[11px] font-semibold text-primary/90">
            rodada em tempo real
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2",
            bump && "animate-bump",
          )}
        >
          <WalletIcon className="size-4 text-primary" />
          {isPending || balance === null ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span className="text-[17px] font-black tabular-nums text-white">
              {formatCents(balance)}
            </span>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-[13px] font-semibold text-foreground sm:flex">
          <UserIcon className="size-4 text-primary" />
          {auth.username ?? "jogador"}
        </div>

        <button
          type="button"
          aria-label="Sair"
          onClick={onLogout}
          className="grid size-[38px] place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-white"
        >
          <LogOutIcon className="size-4" />
        </button>
      </div>
    </header>
  );
}

// Flips on for one animation cycle whenever the balance increases (a cash-out credit landed).
function useBalanceBump(balance: number | null): boolean {
  const previous = useRef<number | null>(null);
  const [bumping, setBumping] = useState(false);

  useEffect(() => {
    const isCredit =
      balance !== null &&
      previous.current !== null &&
      balance > previous.current;
    previous.current = balance;
    if (!isCredit) return;
    setBumping(true);
    const timeoutId = window.setTimeout(() => setBumping(false), 600);
    return () => window.clearTimeout(timeoutId);
  }, [balance]);

  return bumping;
}
