import { useMemo } from "react";
import { UsersIcon } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { formatCents, formatMultiplier } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useParticipantsStore, type Participant } from "../participants-store";
import { Panel, PanelHeader } from "./panel";

// Cashed-out players (the winners) float to the top, then the rest by stake, biggest first.
function compareParticipants(a: Participant, b: Participant): number {
  if (a.status !== b.status) {
    return a.status === "cashed_out" ? -1 : 1;
  }
  if (a.amountCents !== b.amountCents) {
    return b.amountCents - a.amountCents;
  }
  return a.username.localeCompare(b.username);
}

function initialsOf(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export function ParticipantsList({ className }: { className?: string }) {
  const participants = useParticipantsStore((state) => state.participants);
  const ownUsername = auth.username;

  const rows = useMemo(
    () => Array.from(participants.values()).sort(compareParticipants),
    [participants],
  );

  return (
    <Panel className={className}>
      <PanelHeader
        title="Apostas da rodada atual"
        icon={<UsersIcon className="size-4 text-primary" />}
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguém apostou ainda.</p>
      ) : (
        <ul className="flex max-h-[340px] flex-col gap-2 overflow-y-auto">
          {rows.map((participant) => {
            const isSelf = participant.username === ownUsername;
            return (
              <li
                key={participant.betId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "grid size-[34px] shrink-0 place-items-center rounded-full text-xs font-black",
                      isSelf
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/8 text-foreground",
                    )}
                  >
                    {isSelf ? "VC" : initialsOf(participant.username)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {isSelf ? "Você" : participant.username}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground/80">
                      {formatCents(participant.amountCents)}
                    </p>
                  </div>
                </div>
                <ParticipantStatus participant={participant} isSelf={isSelf} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function ParticipantStatus({
  participant,
  isSelf,
}: {
  participant: Participant;
  isSelf: boolean;
}) {
  if (
    participant.status === "cashed_out" &&
    participant.multiplierHundredths !== null
  ) {
    return (
      <span className="shrink-0 text-xs font-bold text-success tabular-nums">
        sacou {formatMultiplier(participant.multiplierHundredths / 100)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-bold",
        isSelf ? "text-info" : "text-muted-foreground",
      )}
    >
      na rodada
    </span>
  );
}
