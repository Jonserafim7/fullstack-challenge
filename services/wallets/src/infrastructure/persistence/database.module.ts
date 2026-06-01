import { Module } from "@nestjs/common";
import { InboxStore } from "../../application/messaging/inbox-store";
import { OutboxStore } from "../../application/messaging/outbox-store";
import { WalletRepository } from "../../application/repositories/wallet.repository";
import { EnvModule } from "../env/env.module";
import { PrismaService } from "./prisma.service";
import { PrismaInboxRepository } from "./prisma-inbox.repository";
import { PrismaOutboxRepository } from "./prisma-outbox.repository";
import { PrismaWalletRepository } from "./prisma-wallet.repository";

@Module({
  imports: [EnvModule],
  providers: [
    PrismaService,
    { provide: WalletRepository, useClass: PrismaWalletRepository },
    { provide: OutboxStore, useClass: PrismaOutboxRepository },
    { provide: InboxStore, useClass: PrismaInboxRepository },
  ],
  exports: [PrismaService, WalletRepository, OutboxStore, InboxStore],
})
export class DatabaseModule {}
