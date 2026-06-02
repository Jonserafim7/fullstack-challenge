import { type ReactNode } from "react";
import {
  deriveCrashPointHundredths,
  verifyChainLink,
} from "@crash/provably-fair";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMultiplier } from "@/lib/format";
import { useRoundVerificationQuery } from "../round-api";
import { type RoundVerification } from "../round-contracts";

// Recomputes a past Round's fairness entirely in the browser from the revealed seeds, using the
// exact same @crash/provably-fair functions the server used to generate it (ADR-0002). Nothing here
// trusts the server's word: the chain link and the Crash Point are both derived locally and then
// compared, so a ✓ is a genuine independent verification.
function verify(data: RoundVerification): {
  chainLinkValid: boolean | null;
  recomputedCrashPoint: number;
  crashPointMatches: boolean;
} {
  const chainLinkValid =
    data.previousSeed === null
      ? null
      : verifyChainLink({
          serverSeed: data.serverSeed,
          previousSeed: data.previousSeed,
        });
  const recomputedCrashPoint = deriveCrashPointHundredths({
    serverSeed: data.serverSeed,
    clientSeed: data.clientSeed,
    houseEdge: data.houseEdge,
  });
  return {
    chainLinkValid,
    recomputedCrashPoint,
    crashPointMatches: recomputedCrashPoint === data.crashPoint,
  };
}

// verdict: true = verified (green check), false = mismatch (red cross), null/undefined = an
// informational row with no verdict (the seeds and house edge are shown, not checked).
function VerdictRow({
  label,
  verdict,
  children,
}: {
  label: string;
  verdict?: boolean | null;
  children: ReactNode;
}) {
  const Icon =
    verdict === true ? CircleCheckIcon : verdict === false ? CircleXIcon : null;
  const tone = verdict ? "text-emerald-400" : "text-destructive";
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-xs break-all text-foreground">
          {children}
        </p>
      </div>
      {Icon && <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />}
    </div>
  );
}

function VerificationBody({ roundNumber }: { roundNumber: number }) {
  const { data, isPending, isError } = useRoundVerificationQuery(roundNumber);

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar os dados de verificação desta rodada.
      </p>
    );
  }

  const { chainLinkValid, recomputedCrashPoint, crashPointMatches } =
    verify(data);

  return (
    <div className="divide-y divide-border">
      <VerdictRow
        label="Elo da cadeia — SHA256(Server Seed) = Commitment"
        verdict={chainLinkValid}
      >
        {data.previousSeed ?? "indisponível para esta rodada"}
      </VerdictRow>
      <VerdictRow label="Server Seed (revelado)">{data.serverSeed}</VerdictRow>
      <VerdictRow label="Client Seed">{data.clientSeed}</VerdictRow>
      <VerdictRow label="House Edge">
        {(data.houseEdge * 100).toFixed(2)}%
      </VerdictRow>
      <VerdictRow
        label="Crash Point — recomputado a partir dos seeds"
        verdict={crashPointMatches}
      >
        {formatMultiplier(recomputedCrashPoint / 100)}
        {!crashPointMatches &&
          ` (servidor: ${formatMultiplier(data.crashPoint / 100)})`}
      </VerdictRow>
    </div>
  );
}

export function RoundVerificationDialog({
  roundNumber,
  onOpenChange,
}: {
  roundNumber: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={roundNumber !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Verificar rodada {roundNumber !== null ? `#${roundNumber}` : ""}
          </DialogTitle>
          <DialogDescription>
            Recalculado no seu navegador a partir dos seeds revelados — nada
            aqui confia na palavra do servidor.
          </DialogDescription>
        </DialogHeader>
        {roundNumber !== null && <VerificationBody roundNumber={roundNumber} />}
      </DialogContent>
    </Dialog>
  );
}
