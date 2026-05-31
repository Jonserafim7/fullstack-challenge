import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import {
  RoundEvent,
  RoundEventPublisher,
  type BettingOpenedEvent,
  type CrashedEvent,
  type RunningEvent,
} from "../../application/realtime/round-event-publisher";
import { JwtVerifier } from "../auth/jwt-verifier";

// Server -> client only (ADR-0003): broadcasts Round phase transitions to every connected
// client. The JWT is validated on connect before the socket is allowed to stay; watching is
// public, so there are no per-player channels yet (owner-only delivery arrives with betting in
// #6/#7). The websocket-only transport lets the upgrade pass cleanly through Kong without the
// polling handshake.
@WebSocketGateway({ transports: ["websocket"] })
export class RoundGateway
  extends RoundEventPublisher
  implements OnGatewayInit, OnGatewayConnection
{
  private readonly logger = new Logger(RoundGateway.name);
  private server?: Server;

  constructor(private readonly jwt: JwtVerifier) {
    super();
  }

  afterInit(server: Server): void {
    this.server = server;
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = readHandshakeToken(client);
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      client.data.playerId = await this.jwt.verify(token);
    } catch {
      client.disconnect();
    }
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
