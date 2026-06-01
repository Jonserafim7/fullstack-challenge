import { Module } from "@nestjs/common";
import { OutboxStore } from "../../application/messaging/outbox-store";
import { RoundRepository } from "../../application/repositories/round.repository";
import { EnvModule } from "../env/env.module";
import { PrismaService } from "./prisma.service";
import { PrismaOutboxRepository } from "./prisma-outbox.repository";
import { PrismaRoundRepository } from "./prisma-round.repository";

@Module({
  imports: [EnvModule],
  providers: [
    PrismaService,
    { provide: RoundRepository, useClass: PrismaRoundRepository },
    { provide: OutboxStore, useClass: PrismaOutboxRepository },
  ],
  exports: [PrismaService, RoundRepository, OutboxStore],
})
export class DatabaseModule {}
