import { describe, test, expect } from "bun:test";
import { Money } from "@crash/money";
import {
  MessageType,
  payoutKey,
  RoutingKey,
  type PayoutCommandPayload,
} from "@crash/messaging";
import { CashOutUnavailableError } from "../../src/application/errors/cash-out-unavailable.error";
import type { NewOutboxMessage } from "../../src/application/messaging/outbox-store";
import type {
  BetCashedOutEvent,
  RoundEventPublisher,
} from "../../src/application/realtime/round-event-publisher";
import type { BetRepository } from "../../src/application/repositories/bet.repository";
import type { RoundRepository } from "../../src/application/repositories/round.repository";
import { CashOutBetUseCase } from "../../src/application/use-cases/cash-out-bet.use-case";
import { Bet, BetStatus } from "../../src/domain/entities/bet";
import { Round, RoundPhase } from "../../src/domain/entities/round";

const PLAYER_ID = "player-1";
const BET_ID = "bet-1";
const STAKE_CENTS = 500;

function runningRound({
  startedAtMsAgo,
  crashPointHundredths,
}: {
  startedAtMsAgo: number;
  crashPointHundredths: number;
}): Round {
  return Round.restore({
    roundNumber: 42,
    crashPointHundredths,
    serverSeed: "s",
    clientSeed: "c",
    houseEdge: 0.01,
    seedHash: "h",
    phase: RoundPhase.RUNNING,
    bettingEndsAt: new Date(),
    startedAt: new Date(Date.now() - startedAtMsAgo),
    crashedAt: null,
  });
}

function confirmedBet(status: BetStatus = BetStatus.CONFIRMED): Bet {
  return Bet.restore({
    betId: BET_ID,
    roundNumber: 42,
    playerId: PLAYER_ID,
    username: "player",
    stake: Money.fromCents(STAKE_CENTS),
    status,
    confirmedAt: new Date(),
    cashedOutMultiplier: null,
    cashedOutAt: null,
  });
}

function fakeRounds(current: Round | null): RoundRepository {
  return {
    findCurrent: async (): Promise<Round | null> => current,
  } as unknown as RoundRepository;
}

interface CashOutCall {
  bet: Bet;
  payoutMessage: NewOutboxMessage;
}

function fakeBets(bet: Bet | null): {
  bets: BetRepository;
  cashedOut: CashOutCall[];
} {
  const cashedOut: CashOutCall[] = [];
  const bets = {
    findByRoundAndPlayer: async (): Promise<Bet | null> => bet,
    cashOut: async (call: CashOutCall): Promise<void> => {
      cashedOut.push(call);
    },
  } as unknown as BetRepository;
  return { bets, cashedOut };
}

function fakePublisher(): {
  publisher: RoundEventPublisher;
  events: BetCashedOutEvent[];
} {
  const events: BetCashedOutEvent[] = [];
  const publisher = {
    betCashedOut: (event: BetCashedOutEvent) => events.push(event),
  } as unknown as RoundEventPublisher;
  return { publisher, events };
}

describe("CashOutBet", () => {
  test("locks the curve multiplier, marks Cashed Out, and enqueues the payout", async () => {
    const round = runningRound({
      startedAtMsAgo: 5_000,
      crashPointHundredths: 1_000,
    });
    const bet = confirmedBet();
    const { bets, cashedOut } = fakeBets(bet);
    const { publisher, events } = fakePublisher();
    const useCase = new CashOutBetUseCase(fakeRounds(round), bets, publisher);

    const result = await useCase.execute({ playerId: PLAYER_ID });

    expect(result.status).toBe(BetStatus.CASHED_OUT);
    // ~5s in, the shared curve sits well above 1.00x and below the 10.00x Crash Point.
    const lockedHundredths = result.cashedOutMultiplier!;
    expect(lockedHundredths).toBeGreaterThan(100);
    expect(lockedHundredths).toBeLessThan(round.crashPointHundredths);

    // The payout the use-case enqueued must equal stake × the exact multiplier it locked.
    const expectedPayoutCents = Number(
      Money.fromCents(STAKE_CENTS).times(lockedHundredths).cents,
    );
    expect(cashedOut).toHaveLength(1);
    const message = cashedOut[0]!.payoutMessage;
    expect(message.messageKey).toBe(payoutKey(BET_ID));
    expect(message.type).toBe(MessageType.WALLET_PAYOUT);
    expect(message.routingKey).toBe(RoutingKey.WALLET_PAYOUT);
    expect(message.payload as PayoutCommandPayload).toEqual({
      betId: BET_ID,
      playerId: PLAYER_ID,
      amountCents: expectedPayoutCents,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      betId: BET_ID,
      multiplierHundredths: lockedHundredths,
      payoutCents: expectedPayoutCents,
    });
  });

  test("never locks below 1.00x when the elapsed time is non-positive", async () => {
    // startedAt one second in the future (a backward clock skew): the floor is 1.00x, paying the
    // stake back — a cash out must never return less than the wager.
    const round = runningRound({
      startedAtMsAgo: -1_000,
      crashPointHundredths: 1_000,
    });
    const bet = confirmedBet();
    const { bets } = fakeBets(bet);
    const { publisher } = fakePublisher();
    const useCase = new CashOutBetUseCase(fakeRounds(round), bets, publisher);

    const result = await useCase.execute({ playerId: PLAYER_ID });

    expect(result.cashedOutMultiplier).toBe(100);
    expect(Number(result.stake.times(result.cashedOutMultiplier!).cents)).toBe(
      STAKE_CENTS,
    );
  });

  test("rejects a cash out when the Round is not running", async () => {
    const betting = Round.open({
      roundNumber: 42,
      crashPointHundredths: 1_000,
      serverSeed: "s",
      clientSeed: "c",
      houseEdge: 0.01,
      seedHash: "h",
      bettingEndsAt: new Date(),
    });
    const bet = confirmedBet();
    const { bets, cashedOut } = fakeBets(bet);
    const { publisher } = fakePublisher();
    const useCase = new CashOutBetUseCase(fakeRounds(betting), bets, publisher);

    await expect(useCase.execute({ playerId: PLAYER_ID })).rejects.toThrow(
      CashOutUnavailableError,
    );
    expect(cashedOut).toHaveLength(0);
  });

  test("rejects when the player has no confirmed bet on the Round", async () => {
    const round = runningRound({
      startedAtMsAgo: 2_000,
      crashPointHundredths: 1_000,
    });
    const { bets } = fakeBets(confirmedBet(BetStatus.PENDING));
    const { publisher } = fakePublisher();
    const useCase = new CashOutBetUseCase(fakeRounds(round), bets, publisher);

    await expect(useCase.execute({ playerId: PLAYER_ID })).rejects.toThrow(
      CashOutUnavailableError,
    );
  });

  test("rejects when the curve has already reached the Crash Point", async () => {
    // Started 60s ago against a 1.50x Crash Point: the curve is long past it, so the Round has
    // crashed even if the phase write lags. Nothing to win.
    const round = runningRound({
      startedAtMsAgo: 60_000,
      crashPointHundredths: 150,
    });
    const { bets, cashedOut } = fakeBets(confirmedBet());
    const { publisher } = fakePublisher();
    const useCase = new CashOutBetUseCase(fakeRounds(round), bets, publisher);

    await expect(useCase.execute({ playerId: PLAYER_ID })).rejects.toThrow(
      CashOutUnavailableError,
    );
    expect(cashedOut).toHaveLength(0);
  });
});
