import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { io, type Socket } from "socket.io-client";
import {
  RoundEvent,
  type BetCashedOutEvent,
  type BetConfirmedEvent,
} from "../../src/application/realtime/round-event-publisher";

const KONG_URL = process.env.KONG_URL ?? "http://localhost:8000";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
// Minimum stake (R$1,00) keeps the shared test wallet usable across repeated runs.
const STAKE_CENTS = 100;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function getAccessToken(username: string): Promise<string> {
  const response = await fetch(
    `${KEYCLOAK_URL}/realms/crash-game/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "crash-game-client",
        username,
        password: "player123",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`token request for ${username} failed: ${response.status}`);
  }
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

async function currentPhase(): Promise<string | null> {
  const response = await fetch(`${KONG_URL}/games/rounds/current`);
  if (response.status === 404) {
    return null;
  }
  const body = (await response.json()) as { phase: string };
  return body.phase;
}

async function waitForPhase(target: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await currentPhase()) === target) {
      return;
    }
    await sleep(100);
  }
}

async function betStatus(token: string, betId: string): Promise<string> {
  const response = await fetch(`${KONG_URL}/games/bets/${betId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { status: string };
  return body.status;
}

async function waitForBetStatus(
  token: string,
  betId: string,
  target: string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let status = "";
  while (Date.now() < deadline) {
    status = await betStatus(token, betId);
    if (status === target) {
      return status;
    }
    await sleep(200);
  }
  return status;
}

async function placeBetDuringBetting(
  token: string,
): Promise<{ betId: string; status: string }> {
  const overallDeadline = Date.now() + 30_000;
  while (Date.now() < overallDeadline) {
    while (
      Date.now() < overallDeadline &&
      (await currentPhase()) !== "BETTING"
    ) {
      await sleep(150);
    }
    const response = await fetch(`${KONG_URL}/games/bet`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ stakeCents: STAKE_CENTS }),
    });
    if (response.status === 202) {
      return (await response.json()) as { betId: string; status: string };
    }
    await sleep(1000);
  }
  throw new Error("could not place a bet during a Betting window");
}

interface CashOutBody {
  status: string;
  cashedOutMultiplier: number | null;
  payoutCents: number | null;
}

async function cashOut(
  token: string,
): Promise<{ httpStatus: number; body: CashOutBody | null }> {
  const response = await fetch(`${KONG_URL}/games/bet/cashout`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const body =
    response.status === 200 ? ((await response.json()) as CashOutBody) : null;
  return { httpStatus: response.status, body };
}

// Connects like the browser client does — through Kong, websocket transport, JWT in the handshake.
// Kong's keepalive to the Bun upstream occasionally drops an upgrade, so (as in the browser) we let
// socket.io reconnect and resolve on the first successful connect, only failing after a timeout.
function connect(token: string, timeoutMs = 20_000): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(KONG_URL, {
      path: "/games/socket.io",
      transports: ["websocket"],
      auth: { token },
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("socket did not connect within timeout"));
    }, timeoutMs);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
  });
}

// Waits until an event matching the predicate has been collected, or times out (returns null).
async function waitFor<T>(
  collected: T[],
  predicate: (event: T) => boolean,
  timeoutMs: number,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = collected.find(predicate);
    if (match) {
      return match;
    }
    await sleep(100);
  }
  return null;
}

// AC #4: a Bet and a Cash Out placed by one player are broadcast to a *second* client. Player A
// (player) places and cashes out; player B (player2) only listens and must see both public events.
describe("live presence e2e (broadcast to a second client)", () => {
  let tokenA: string;
  let tokenB: string;
  let clientB: Socket;

  const confirmedOnB: BetConfirmedEvent[] = [];
  const cashedOutOnB: BetCashedOutEvent[] = [];

  beforeAll(async () => {
    [tokenA, tokenB] = await Promise.all([
      getAccessToken("player"),
      getAccessToken("player2"),
    ]);
    // Ensure player A's wallet exists and is funded by the seed (idempotent create).
    await fetch(`${KONG_URL}/wallets`, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}` },
    });

    clientB = await connect(tokenB);
    clientB.on(RoundEvent.BET_CONFIRMED, (event: BetConfirmedEvent) =>
      confirmedOnB.push(event),
    );
    clientB.on(RoundEvent.BET_CASHED_OUT, (event: BetCashedOutEvent) =>
      cashedOutOnB.push(event),
    );
  });

  afterAll(() => {
    clientB?.disconnect();
  });

  test("a second client receives another player's bet.confirmed and bet.cashed_out", async () => {
    const overallDeadline = Date.now() + 90_000;
    let cashedBetId: string | null = null;
    let placedAmountCents = 0;

    // Retry across Rounds: a Round whose Crash Point is near 1.00x crashes before we can cash out,
    // so that bet Loses; try a fresh one until a Round runs long enough to cash out.
    while (Date.now() < overallDeadline && cashedBetId === null) {
      const placed = await placeBetDuringBetting(tokenA);
      const confirmed = await waitForBetStatus(
        tokenA,
        placed.betId,
        "CONFIRMED",
        15_000,
      );
      if (confirmed !== "CONFIRMED") {
        continue;
      }
      placedAmountCents = STAKE_CENTS;

      await waitForPhase("RUNNING", 15_000);
      const { httpStatus } = await cashOut(tokenA);
      if (httpStatus === 200) {
        cashedBetId = placed.betId;
      }
      // A 409 means the Round crashed before we cashed out — retry on the next Round.
    }

    expect(cashedBetId).not.toBeNull();

    // The second client must have seen the public confirmation, with A's username and stake.
    const confirmed = await waitFor(
      confirmedOnB,
      (event) => event.betId === cashedBetId,
      10_000,
    );
    expect(confirmed).not.toBeNull();
    expect(confirmed!.username).toBe("player");
    expect(confirmed!.amountCents).toBe(placedAmountCents);

    // ...and the public cash-out, with the locked multiplier and payout.
    const cashedOut = await waitFor(
      cashedOutOnB,
      (event) => event.betId === cashedBetId,
      10_000,
    );
    expect(cashedOut).not.toBeNull();
    expect(cashedOut!.username).toBe("player");
    // A cash-out locks at least 1.00x (100 hundredths) — exactly 1.00x when it lands the instant
    // Running begins. The locked-multiplier math is covered by bets.e2e; here we only assert the
    // event reached the second client intact.
    expect(cashedOut!.multiplierHundredths).toBeGreaterThanOrEqual(100);
    expect(cashedOut!.payoutCents).toBeGreaterThanOrEqual(STAKE_CENTS);
  }, 120_000);
});
