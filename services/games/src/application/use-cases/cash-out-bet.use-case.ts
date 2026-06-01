import { Injectable } from "@nestjs/common";
import { multiplierAt } from "@crash/crash-curve";
import {
  MessageType,
  payoutKey,
  RoutingKey,
  type PayoutCommandPayload,
} from "@crash/messaging";
import { CashOutUnavailableError } from "../errors/cash-out-unavailable.error";
import { NewOutboxMessage } from "../messaging/outbox-store";
import { RoundEventPublisher } from "../realtime/round-event-publisher";
import { BetRepository } from "../repositories/bet.repository";
import { RoundRepository } from "../repositories/round.repository";
import { Bet, BetStatus } from "../../domain/entities/bet";
import { RoundPhase } from "../../domain/entities/round";

const ONE_X_HUNDREDTHS = 100;

// Cashes out the caller's Bet on the current Round. Cash out is authoritative and synchronous in
// games (ADR-0001): the server — never the client — locks the multiplier from the shared curve at
// the instant of the request, marks the Bet Cashed Out, and enqueues the payout credit in the same
// transaction. The credit (stake × locked multiplier) then flows to wallets asynchronously and
// unconditionally. Deciding the win in games prevents a player from losing a cash out to wallets
// latency during a crash.
@Injectable()
export class CashOutBetUseCase {
  constructor(
    private readonly rounds: RoundRepository,
    private readonly bets: BetRepository,
    private readonly publisher: RoundEventPublisher,
  ) {}

  async execute({ playerId }: { playerId: string }): Promise<Bet> {
    const round = await this.rounds.findCurrent();
    if (!round || round.phase !== RoundPhase.RUNNING || !round.startedAt) {
      throw new CashOutUnavailableError("the Round is not running");
    }

    const bet = await this.bets.findByRoundAndPlayer({
      roundNumber: round.roundNumber,
      playerId,
    });
    if (!bet || bet.status !== BetStatus.CONFIRMED) {
      throw new CashOutUnavailableError("no confirmed bet to cash out");
    }

    const now = new Date();
    const elapsedMs = now.getTime() - round.startedAt.getTime();
    const lockedHundredths = Math.floor(
      multiplierAt({ elapsedMs }) * ONE_X_HUNDREDTHS,
    );
    // The phase is read from the database, which can lag the engine's crash by a few ms. The curve
    // is the real clock: if it has already reached the Crash Point, the Round has crashed and there
    // is nothing to win — reject rather than pay out a multiplier the player never actually hit.
    if (lockedHundredths >= round.crashPointHundredths) {
      throw new CashOutUnavailableError("the Round has crashed");
    }

    bet.cashOut({ multiplierHundredths: lockedHundredths, at: now });
    const payoutCents = Number(bet.stake.times(lockedHundredths).cents);
    await this.bets.cashOut({
      bet,
      payoutMessage: payoutCommand({ bet, payoutCents }),
    });

    this.publisher.betCashedOut({
      betId: bet.betId,
      roundNumber: bet.roundNumber,
      username: bet.username,
      multiplierHundredths: lockedHundredths,
      payoutCents,
    });
    return bet;
  }
}

function payoutCommand({
  bet,
  payoutCents,
}: {
  bet: Bet;
  payoutCents: number;
}): NewOutboxMessage {
  const payload: PayoutCommandPayload = {
    betId: bet.betId,
    playerId: bet.playerId,
    amountCents: payoutCents,
  };
  return {
    messageKey: payoutKey(bet.betId),
    type: MessageType.WALLET_PAYOUT,
    routingKey: RoutingKey.WALLET_PAYOUT,
    payload,
  };
}
