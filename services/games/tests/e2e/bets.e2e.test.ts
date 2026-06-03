import { describe, test, expect, beforeAll } from "bun:test";

const KONG_URL = process.env.KONG_URL ?? "http://localhost:8000";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
// Minimum stake (R$1,00) keeps the shared test wallet usable across repeated runs.
const STAKE_CENTS = 100;
// Maximum stake (R$1.000,00). A bet this large outruns a wallet that holds less, which is how the
// rejection test forces an insufficient-funds refusal without a balance-reset endpoint.
const MAX_STAKE_CENTS = 100_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function getAccessToken(): Promise<string> {
  const response = await fetch(
    `${KEYCLOAK_URL}/realms/crash-game/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "crash-game-client",
        username: "player",
        password: "player123",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`token request failed: ${response.status}`);
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

async function balanceCents(token: string): Promise<number> {
  const response = await fetch(`${KONG_URL}/wallets/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { balance: number };
  return body.balance;
}

async function betStatus(token: string, betId: string): Promise<string> {
  const response = await fetch(`${KONG_URL}/games/bets/${betId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { status: string };
  return body.status;
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

async function waitForPhase(target: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await currentPhase()) === target) {
      return;
    }
    await sleep(100);
  }
}

// The Wallet is shared and the saga settles asynchronously (ADR-0001), so a balance read can land
// mid-settlement. Returns a balance that has held steady for `settleMs`, so the money-invariant
// assertions ("moving no money") baseline against a quiescent Wallet, not one with a credit still
// in flight from an earlier test.
async function stableBalanceCents(
  token: string,
  settleMs = 1500,
  timeoutMs = 20_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let last = await balanceCents(token);
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await sleep(250);
    const current = await balanceCents(token);
    if (current !== last) {
      last = current;
      stableSince = Date.now();
      continue;
    }
    if (Date.now() - stableSince >= settleMs) {
      return current;
    }
  }
  return last;
}

// Places exactly one Bet during a Betting window. A 409 means the window closed between the phase
// read and the request (or a stale prior bet on this Round); we wait for the next Round and retry,
// so only the first 202 ever debits.
async function placeBetDuringBetting(
  token: string,
  stakeCents: number = STAKE_CENTS,
): Promise<{
  betId: string;
  status: string;
}> {
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
      body: JSON.stringify({ stakeCents }),
    });
    if (response.status === 202) {
      return (await response.json()) as { betId: string; status: string };
    }
    await sleep(1000);
  }
  throw new Error("could not place a bet during a Betting window");
}

describe("bets e2e (through Kong)", () => {
  let token: string;

  beforeAll(async () => {
    token = await getAccessToken();
    // Ensure the player's wallet exists (idempotent).
    await fetch(`${KONG_URL}/wallets`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
  });

  test("rejects an unauthenticated bet", async () => {
    const response = await fetch(`${KONG_URL}/games/bet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stakeCents: STAKE_CENTS }),
    });

    expect(response.status).toBe(401);
  });

  test("places a Pending bet that becomes Confirmed and debits the stake", async () => {
    const balanceBefore = await balanceCents(token);

    const placed = await placeBetDuringBetting(token);
    expect(typeof placed.betId).toBe("string");
    expect(placed.status).toBe("PENDING");

    let status = placed.status;
    const confirmDeadline = Date.now() + 15_000;
    while (Date.now() < confirmDeadline) {
      status = await betStatus(token, placed.betId);
      if (status === "CONFIRMED") {
        break;
      }
      await sleep(250);
    }
    expect(status).toBe("CONFIRMED");

    const balanceAfter = await balanceCents(token);
    expect(balanceAfter).toBe(balanceBefore - STAKE_CENTS);
  }, 60_000);

  test("cashes out a Confirmed bet during Running and credits the payout", async () => {
    // Retry across Rounds: a Round whose Crash Point is near 1.00x crashes before we can POST, so
    // that bet Loses and we try a fresh one. Eventually a Round runs long enough to cash out.
    const overallDeadline = Date.now() + 90_000;
    let cashed: CashOutBody | null = null;
    let balanceBeforeCashout = 0;

    while (Date.now() < overallDeadline && cashed === null) {
      const placed = await placeBetDuringBetting(token);
      const confirmed = await waitForBetStatus(
        token,
        placed.betId,
        "CONFIRMED",
        15_000,
      );
      if (confirmed !== "CONFIRMED") {
        continue;
      }
      balanceBeforeCashout = await balanceCents(token);
      await waitForPhase("RUNNING", 15_000);
      // Let the multiplier climb clear of 1.00x before cashing out, so the locked multiplier (and
      // payout) is unambiguously above the stake. If the Round crashes first the cash out returns 409
      // and the loop retries on a fresh Round.
      await sleep(800);
      const { httpStatus, body } = await cashOut(token);
      if (httpStatus === 200) {
        cashed = body;
      }
      // A 409 means the Round crashed before we cashed out (or is no longer Running) — retry.
    }

    expect(cashed).not.toBeNull();
    expect(cashed!.status).toBe("CASHED_OUT");
    expect(cashed!.cashedOutMultiplier).toBeGreaterThan(100);
    expect(cashed!.payoutCents).toBeGreaterThan(0);

    // The payout credit is asynchronous; poll until it lands.
    const expectedBalance = balanceBeforeCashout + cashed!.payoutCents!;
    const creditDeadline = Date.now() + 15_000;
    let balance = balanceBeforeCashout;
    while (Date.now() < creditDeadline) {
      balance = await balanceCents(token);
      if (balance === expectedBalance) {
        break;
      }
      await sleep(250);
    }
    expect(balance).toBe(expectedBalance);
  }, 120_000);

  test("rejects an insufficient-funds bet through the broker, moving no money", async () => {
    const drainDeadline = Date.now() + 90_000;
    while (
      Date.now() < drainDeadline &&
      (await balanceCents(token)) >= MAX_STAKE_CENTS
    ) {
      const filler = await placeBetDuringBetting(token, STAKE_CENTS);
      await waitForBetStatus(token, filler.betId, "CONFIRMED", 15_000);
    }

    const balanceBefore = await stableBalanceCents(token);
    expect(balanceBefore).toBeLessThan(MAX_STAKE_CENTS);

    const placed = await placeBetDuringBetting(token, MAX_STAKE_CENTS);
    expect(placed.status).toBe("PENDING");

    const finalStatus = await waitForBetStatus(
      token,
      placed.betId,
      "REJECTED",
      15_000,
    );
    expect(finalStatus).toBe("REJECTED");

    const balanceAfter = await stableBalanceCents(token);
    expect(balanceAfter).toBe(balanceBefore);
  }, 120_000);

  test("settles a Confirmed bet as Lost on crash, moving no money", async () => {
    const placed = await placeBetDuringBetting(token);
    const confirmed = await waitForBetStatus(
      token,
      placed.betId,
      "CONFIRMED",
      15_000,
    );
    expect(confirmed).toBe("CONFIRMED");

    const balanceAfterConfirm = await stableBalanceCents(token);

    const finalStatus = await waitForBetStatus(
      token,
      placed.betId,
      "LOST",
      60_000,
    );
    expect(finalStatus).toBe("LOST");

    const balanceAfterLoss = await stableBalanceCents(token);
    expect(balanceAfterLoss).toBe(balanceAfterConfirm);
  }, 90_000);
});
