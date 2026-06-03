import { toast } from "sonner";
import { BadgeCheckIcon, TriangleAlertIcon } from "lucide-react";
import { formatCents, formatMultiplier } from "@/lib/format";

const successIcon = <BadgeCheckIcon className="size-[18px] text-success" />;
const errorIcon = (
  <TriangleAlertIcon className="size-[18px] text-destructive" />
);

export function notifyCashOutSuccess({
  multiplierHundredths,
  payoutCents,
}: {
  multiplierHundredths: number;
  payoutCents: number;
}) {
  toast.success(`Sacou em ${formatMultiplier(multiplierHundredths / 100)}`, {
    description: `Pagamento de ${formatCents(payoutCents)} creditado.`,
    icon: successIcon,
  });
}

export function notifyBetConfirmed({ stakeCents }: { stakeCents: number }) {
  toast.success("Aposta confirmada", {
    description: `${formatCents(stakeCents)} na rodada — boa sorte!`,
    icon: successIcon,
  });
}

export function notifyLateCashOut() {
  toast.error("Tarde demais", {
    description: "A rodada já crashou.",
    icon: errorIcon,
  });
}

export function notifyBetError(message: string) {
  toast.error("Não foi possível apostar", {
    description: message,
    icon: errorIcon,
  });
}

export function notifyBetRejected() {
  toast.error("Saldo insuficiente", {
    description: "Você não tem saldo para essa aposta.",
    icon: errorIcon,
  });
}

export function notifyCrashedLost({
  crashPointHundredths,
}: {
  crashPointHundredths: number;
}) {
  toast.error(`Crashou em ${formatMultiplier(crashPointHundredths / 100)}`, {
    description: "Você não sacou a tempo — aposta perdida.",
    icon: errorIcon,
  });
}
