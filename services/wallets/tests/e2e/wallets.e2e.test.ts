import { describe, test, expect, beforeAll } from "bun:test";

const KONG_URL = process.env.KONG_URL ?? "http://localhost:8000";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
const STARTING_BALANCE_CENTS = Number(
  process.env.WALLET_STARTING_BALANCE_CENTS ?? "100000",
);

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

describe("wallets e2e (through Kong)", () => {
  let token: string;

  beforeAll(async () => {
    token = await getAccessToken();
  });

  test("rejects an unauthenticated request", async () => {
    const response = await fetch(`${KONG_URL}/wallets/me`);

    expect(response.status).toBe(401);
  });

  test("creates the authenticated player's wallet", async () => {
    const response = await fetch(`${KONG_URL}/wallets`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });

    expect([200, 201]).toContain(response.status);
    const body = (await response.json()) as {
      playerId: string;
      balance: number;
    };
    expect(typeof body.playerId).toBe("string");
    expect(Number.isInteger(body.balance)).toBe(true);
  });

  test("returns the player's balance as integer cents", async () => {
    const response = await fetch(`${KONG_URL}/wallets/me`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      playerId: string;
      balance: number;
    };
    expect(body.balance).toBe(STARTING_BALANCE_CENTS);
    expect(Number.isInteger(body.balance)).toBe(true);
  });
});
