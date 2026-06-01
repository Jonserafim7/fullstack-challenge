import { Logger } from "@nestjs/common";
import { OnGatewayInit, WebSocketGateway } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import {
  RoundEvent,
  RoundEventPublisher,
  type BetCashedOutEvent,
  type BetConfirmedEvent,
  type BetRejectedEvent,
  type BettingOpenedEvent,
  type CrashedEvent,
  type RunningEvent,
} from "../../application/realtime/round-event-publisher";
import { JwtVerifier } from "../auth/jwt-verifier";

// Server -> client only (ADR-0003): broadcasts Round phase transitions to every connected client,
// and delivers owner-only events (a private bet.rejected) to a per-player room. The JWT is
// validated in connection middleware, which also joins the socket to a room named after its
// playerId, so an unauthenticated socket is rejected before it joins anything — no event can race
// the rejection. The websocket-only transport lets the upgrade pass cleanly through Kong without
// the polling handshake.
@WebSocketGateway({ transports: ["websocket"] })
export class RoundGateway extends RoundEventPublisher implements OnGatewayInit {
  private readonly logger = new Logger(RoundGateway.name);
  private server?: Server;

  constructor(private readonly jwt: JwtVerifier) {
    super();
  }

  afterInit(server: Server): void {
    this.server = server;
    server.use((socket, next) => {
      void this.authenticate(socket)
        .then(() => next())
        .catch(() => next(new Error("Unauthorized")));
    });
  }

  async authenticate(socket: Socket): Promise<void> {
    const token = readHandshakeToken(socket);
    if (!token) {
      throw new Error("Missing token");
    }
    const playerId = await this.jwt.verify(token);
    socket.data.playerId = playerId;
    // Join a room named after the player so owner-only events reach every tab this player has open,
    // and no one else (#7). Public broadcasts still go to all sockets via server.emit.
    await socket.join(playerId);
  }

  bettingOpened(event: BettingOpenedEvent): void {
    this.broadcast(RoundEvent.BETTING_OPENED, event);
  }

  running(event: RunningEvent): void {
    this.broadcast(RoundEvent.RUNNING, event);
  }

  crashed(event: CrashedEvent): void {
    this.broadcast(RoundEvent.CRASHED, event);
  }

  betConfirmed(event: BetConfirmedEvent): void {
    this.broadcast(RoundEvent.BET_CONFIRMED, event);
  }

  betCashedOut(event: BetCashedOutEvent): void {
    this.broadcast(RoundEvent.BET_CASHED_OUT, event);
  }

  betRejected(event: BetRejectedEvent): void {
    this.emitToPlayer(event.playerId, RoundEvent.BET_REJECTED, event);
  }

  // Transitions emitted before the socket server is ready (during engine bootstrap) have no
  // possible subscribers, so dropping them is safe — late joiners hydrate via REST.
  private broadcast(event: string, payload: object): void {
    if (!this.server) {
      this.logger.warn(`Dropped ${event}: socket server not ready`);
      return;
    }
    this.server.emit(event, payload);
  }

  // Owner-only delivery: emits to the room the player's sockets joined at the handshake (#7).
  private emitToPlayer(playerId: string, event: string, payload: object): void {
    if (!this.server) {
      this.logger.warn(
        `Dropped ${event} for ${playerId}: socket server not ready`,
      );
      return;
    }
    this.server.to(playerId).emit(event, payload);
  }
}

function readHandshakeToken(client: Socket): string | null {
  const token = client.handshake.auth?.token;
  return typeof token === "string" && token.length > 0 ? token : null;
}
