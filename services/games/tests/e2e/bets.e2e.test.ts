import { describe, test, expect, beforeAll } from "bun:test";

const KONG_URL = process.env.KONG_URL ?? "http://localhost:8000";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
// Minimum stake (R$1,00) keeps the shared test wallet usable across repeated runs.
const STAKE_CENTS = 100;

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

// Places exactly one Bet during a Betting window. A 409 means the window closed between the phase
// read and the request (or a stale prior bet on this Round); we wait for the next Round and retry,
// so only the first 202 ever debits.
async function placeBetDuringBetting(token: string): Promise<{
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
      body: JSON.stringify({ stakeCents: STAKE_CENTS }),
    });
    if (response.status === 202) {
      return (await response.json()) as { betId: string; status: string };
    }
    // Betting closed mid-request — let this Round finish, then try the next one.
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
});
