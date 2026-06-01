import { Logger } from "@nestjs/common";
import { OnGatewayInit, WebSocketGateway } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import {
  RoundEvent,
  RoundEventPublisher,
  type BetCashedOutEvent,
  type BetConfirmedEvent,
  type BettingOpenedEvent,
  type CrashedEvent,
  type RunningEvent,
} from "../../application/realtime/round-event-publisher";
import { JwtVerifier } from "../auth/jwt-verifier";

// Server -> client only (ADR-0003): broadcasts Round phase transitions to every connected
// client. The JWT is validated in connection middleware, so an unauthenticated socket is
// rejected before it joins the broadcast set — no event can race the rejection. Watching is
// public, so there are no per-player channels yet (owner-only delivery arrives with betting in
// #6/#7). The websocket-only transport lets the upgrade pass cleanly through Kong without the
// polling handshake.
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
    socket.data.playerId = await this.jwt.verify(token);
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

  // Transitions emitted before the socket server is ready (during engine bootstrap) have no
  // possible subscribers, so dropping them is safe — late joiners hydrate via REST.
  private broadcast(event: string, payload: object): void {
    if (!this.server) {
      this.logger.warn(`Dropped ${event}: socket server not ready`);
      return;
    }
    this.server.emit(event, payload);
  }
}

function readHandshakeToken(client: Socket): string | null {
  const token = client.handshake.auth?.token;
  return typeof token === "string" && token.length > 0 ? token : null;
}
