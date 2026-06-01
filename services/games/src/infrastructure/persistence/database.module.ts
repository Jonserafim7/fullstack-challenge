import { Module } from "@nestjs/common";
import { InboxStore } from "../../application/messaging/inbox-store";
import { OutboxStore } from "../../application/messaging/outbox-store";
import { BetRepository } from "../../application/repositories/bet.repository";
import { RoundRepository } from "../../application/repositories/round.repository";
import { EnvModule } from "../env/env.module";
import { PrismaService } from "./prisma.service";
import { PrismaBetRepository } from "./prisma-bet.repository";
import { PrismaInboxRepository } from "./prisma-inbox.repository";
import { PrismaOutboxRepository } from "./prisma-outbox.repository";
import { PrismaRoundRepository } from "./prisma-round.repository";

@Module({
  imports: [EnvModule],
  providers: [
    PrismaService,
    { provide: RoundRepository, useClass: PrismaRoundRepository },
    { provide: BetRepository, useClass: PrismaBetRepository },
    { provide: OutboxStore, useClass: PrismaOutboxRepository },
    { provide: InboxStore, useClass: PrismaInboxRepository },
  ],
  exports: [
    PrismaService,
    RoundRepository,
    BetRepository,
    OutboxStore,
    InboxStore,
  ],
})
export class DatabaseModule {}
