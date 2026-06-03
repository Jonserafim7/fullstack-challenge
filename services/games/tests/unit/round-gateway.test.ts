import { describe, test, expect } from "bun:test";
import { RoundGateway } from "../../src/infrastructure/realtime/round.gateway";
import type { JwtVerifier } from "../../src/infrastructure/auth/jwt-verifier";

interface EmittedEvent {
  event: string;
  payload: unknown;
  room?: string;
}

function buildGateway(jwt: JwtVerifier): {
  gateway: RoundGateway;
  emitted: EmittedEvent[];
} {
  const emitted: EmittedEvent[] = [];
  const gateway = new RoundGateway(jwt);
  gateway.afterInit({
    emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
    to: (room: string) => ({
      emit: (event: string, payload: unknown) =>
        emitted.push({ event, payload, room }),
    }),
    use: () => {},
  } as never);
  return { gateway, emitted };
}

function fakeSocket(token?: string) {
  const joined: string[] = [];
  return {
    handshake: { auth: token === undefined ? {} : { token } },
    data: {} as Record<string, unknown>,
    join: (room: string) => {
      joined.push(room);
    },
    joined,
  };
}

const acceptingJwt = {
  verify: async () => "player-sub",
} as unknown as JwtVerifier;
const rejectingJwt = {
  verify: async () => {
    throw new Error("invalid");
  },
} as unknown as JwtVerifier;

describe("RoundGateway broadcasts", () => {
  test("maps each phase to its ADR-0003 event name and payload", () => {
    const { gateway, emitted } = buildGateway(acceptingJwt);

    gateway.bettingOpened({
      roundNumber: 7,
      seedHash: "h",
      bettingEndsAt: "t",
    });
    gateway.running({ roundNumber: 7, startedAt: "s" });
    gateway.crashed({
      roundNumber: 7,
      crashPoint: 247,
      crashedAt: "c",
      verification: {
        serverSeed: "ss",
        previousSeed: "ps",
        clientSeed: "cs",
        houseEdge: 0.01,
      },
    });

    expect(emitted.map((e) => e.event)).toEqual([
      "round.betting_opened",
      "round.running",
      "round.crashed",
    ]);
    expect(emitted[2].payload).toMatchObject({
      roundNumber: 7,
      crashPoint: 247,
    });
  });

  test("does not throw when a transition fires before the server is ready", () => {
    const gateway = new RoundGateway(acceptingJwt);

    expect(() =>
      gateway.running({ roundNumber: 1, startedAt: "s" }),
    ).not.toThrow();
  });

  test("delivers a rejection only to the owning player's room", () => {
    const { gateway, emitted } = buildGateway(acceptingJwt);

    gateway.betRejected({
      betId: "bet-1",
      roundNumber: 7,
      playerId: "player-9",
      reason: "INSUFFICIENT_BALANCE",
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe("bet.rejected");
    expect(emitted[0].room).toBe("player-9");
    expect(emitted[0].payload).toMatchObject({
      betId: "bet-1",
      reason: "INSUFFICIENT_BALANCE",
    });
  });
});

describe("RoundGateway JWT authentication", () => {
  test("rejects a socket with no token", async () => {
    const { gateway } = buildGateway(acceptingJwt);
    const socket = fakeSocket();

    await expect(gateway.authenticate(socket as never)).rejects.toThrow();
    expect(socket.data.playerId).toBeUndefined();
  });

  test("rejects a socket with an invalid token", async () => {
    const { gateway } = buildGateway(rejectingJwt);
    const socket = fakeSocket("bad-token");

    await expect(gateway.authenticate(socket as never)).rejects.toThrow();
    expect(socket.data.playerId).toBeUndefined();
  });

  test("accepts a valid token, records the player id, and joins their room", async () => {
    const { gateway } = buildGateway(acceptingJwt);
    const socket = fakeSocket("good-token");

    await gateway.authenticate(socket as never);

    expect(socket.data.playerId).toBe("player-sub");
    expect(socket.joined).toContain("player-sub");
  });
});
