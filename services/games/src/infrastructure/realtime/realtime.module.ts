import { Module } from "@nestjs/common";
import { RoundEventPublisher } from "../../application/realtime/round-event-publisher";
import { AuthModule } from "../auth/auth.module";
import { RoundGateway } from "./round.gateway";

@Module({
  imports: [AuthModule],
  providers: [
    RoundGateway,
    { provide: RoundEventPublisher, useExisting: RoundGateway },
  ],
  exports: [RoundEventPublisher],
})
export class RealtimeModule {}
