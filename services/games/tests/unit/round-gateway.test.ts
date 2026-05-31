import { describe, test, expect } from "bun:test";
import { RoundGateway } from "../../src/infrastructure/realtime/round.gateway";
import type { JwtVerifier } from "../../src/infrastructure/auth/jwt-verifier";

interface EmittedEvent {
  event: string;
  payload: unknown;
}

function buildGateway(jwt: JwtVerifier): {
  gateway: RoundGateway;
  emitted: EmittedEvent[];
} {
  const emitted: EmittedEvent[] = [];
  const gateway = new RoundGateway(jwt);
  gateway.afterInit({
    emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
  } as never);
  return { gateway, emitted };
}

function fakeSocket(token?: string) {
  return {
    handshake: { auth: token === undefined ? {} : { token } },
    data: {} as Record<string, unknown>,
    disconnected: false,
    disconnect(): void {
      this.disconnected = true;
    },
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
});

describe("RoundGateway JWT on connect", () => {
  test("disconnects a socket with no token", async () => {
    const { gateway } = buildGateway(acceptingJwt);
    const socket = fakeSocket();

    await gateway.handleConnection(socket as never);

    expect(socket.disconnected).toBe(true);
    expect(socket.data.playerId).toBeUndefined();
  });

  test("disconnects a socket with an invalid token", async () => {
    const { gateway } = buildGateway(rejectingJwt);
    const socket = fakeSocket("bad-token");

    await gateway.handleConnection(socket as never);

    expect(socket.disconnected).toBe(true);
    expect(socket.data.playerId).toBeUndefined();
  });

  test("keeps a socket with a valid token and records the player id", async () => {
    const { gateway } = buildGateway(acceptingJwt);
    const socket = fakeSocket("good-token");

    await gateway.handleConnection(socket as never);

    expect(socket.disconnected).toBe(false);
    expect(socket.data.playerId).toBe("player-sub");
  });
});
