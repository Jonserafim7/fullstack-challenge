import { Module } from "@nestjs/common";
import { RoundRepository } from "../../application/repositories/round.repository";
import { EnvModule } from "../env/env.module";
import { PrismaService } from "./prisma.service";
import { PrismaRoundRepository } from "./prisma-round.repository";

@Module({
  imports: [EnvModule],
  providers: [
    PrismaService,
    { provide: RoundRepository, useClass: PrismaRoundRepository },
  ],
  exports: [PrismaService, RoundRepository],
})
export class DatabaseModule {}
