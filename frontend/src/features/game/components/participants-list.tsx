import { useMemo } from "react";
import { auth } from "@/lib/auth/auth";
import { formatCents, formatMultiplier } from "@/lib/format";
import { useParticipantsStore, type Participant } from "../participants-store";

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

export function ParticipantsList() {
  const participants = useParticipantsStore((state) => state.participants);
  const ownUsername = auth.username;

  const rows = useMemo(
    () => Array.from(participants.values()).sort(compareParticipants),
    [participants],
  );

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Ninguém apostou ainda.</p>
    );
  }

  return (
    <ul className="space-y-1">
      {rows.map((participant) => (
        <li
          key={participant.betId}
          className="flex items-center justify-between gap-2 text-sm tabular-nums"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{participant.username}</span>
            {participant.username === ownUsername && (
              <span className="shrink-0 rounded bg-primary/15 px-1 text-[10px] font-medium text-primary">
                Você
              </span>
            )}
          </span>
          <ParticipantStatus participant={participant} />
        </li>
      ))}
    </ul>
  );
}

function ParticipantStatus({ participant }: { participant: Participant }) {
  if (
    participant.status === "cashed_out" &&
    participant.multiplierHundredths !== null
  ) {
    return (
      <span className="shrink-0 font-medium text-emerald-500">
        {formatCents(participant.amountCents)} · sacou em{" "}
        {formatMultiplier(participant.multiplierHundredths / 100)} (+
        {formatCents(participant.payoutCents ?? 0)})
      </span>
    );
  }
  return (
    <span className="shrink-0 text-muted-foreground">
      {formatCents(participant.amountCents)} · na rodada
    </span>
  );
}
