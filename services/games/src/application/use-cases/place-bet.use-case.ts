import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Money } from "@crash/money";
import {
  debitKey,
  MessageType,
  RoutingKey,
  type DebitCommandPayload,
} from "@crash/messaging";
import { BettingClosedError } from "../errors/betting-closed.error";
import { InvalidStakeError } from "../errors/invalid-stake.error";
import { NewOutboxMessage } from "../messaging/outbox-store";
import { BetRepository } from "../repositories/bet.repository";
import { RoundRepository } from "../repositories/round.repository";
import { Bet } from "../../domain/entities/bet";
import { RoundPhase } from "../../domain/entities/round";

export const MIN_STAKE_CENTS = 100;
export const MAX_STAKE_CENTS = 100_000;

@Injectable()
export class PlaceBetUseCase {
  constructor(
    private readonly rounds: RoundRepository,
    private readonly bets: BetRepository,
  ) {}

  async execute({
    playerId,
    username,
    stakeCents,
  }: {
    playerId: string;
    username: string;
    stakeCents: number;
  }): Promise<Bet> {
    assertValidStake(stakeCents);

    const round = await this.rounds.findCurrent();
    if (!round || round.phase !== RoundPhase.BETTING) {
      throw new BettingClosedError();
    }

    const bet = Bet.place({
      betId: randomUUID(),
      roundNumber: round.roundNumber,
      playerId,
      username,
      stake: Money.fromCents(stakeCents),
    });

    await this.bets.place({ bet, debitMessage: debitCommand(bet) });
    return bet;
  }
}

function assertValidStake(stakeCents: number): void {
  if (!Number.isInteger(stakeCents)) {
    throw new InvalidStakeError("Stake must be a whole number of cents");
  }
  if (stakeCents < MIN_STAKE_CENTS || stakeCents > MAX_STAKE_CENTS) {
    throw new InvalidStakeError(
      `Stake must be between ${MIN_STAKE_CENTS} and ${MAX_STAKE_CENTS} cents`,
    );
  }
}

function debitCommand(bet: Bet): NewOutboxMessage {
  const payload: DebitCommandPayload = {
    betId: bet.betId,
    playerId: bet.playerId,
    stakeCents: Number(bet.stake.cents),
  };
  return {
    messageKey: debitKey(bet.betId),
    type: MessageType.WALLET_DEBIT,
    routingKey: RoutingKey.WALLET_DEBIT,
    payload,
  };
}
