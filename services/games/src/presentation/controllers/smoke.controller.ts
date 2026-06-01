import { randomUUID } from "node:crypto";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { EnqueueSmokePingUseCase } from "../../application/use-cases/enqueue-smoke-ping.use-case";
import { SmokePingRequestDto } from "../dtos/smoke-ping-request.dto";

// Dev-only trigger for the #6 messaging smoke test. Driven directly on :4001 (not routed through
// Kong) to enqueue a ping and prove the games -> wallets -> games broker round-trip. Carries no
// auth and no game domain logic; it exists to exercise the plumbing, not the gameplay.
@ApiTags("smoke")
@Controller("internal/smoke")
export class SmokeController {
  constructor(private readonly enqueueSmokePing: EnqueueSmokePingUseCase) {}

  @Post("ping")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Enqueue a smoke ping that round-trips through wallets and back",
  })
  async ping(
    @Body() body: SmokePingRequestDto,
  ): Promise<{ correlationId: string }> {
    const correlationId = body.correlationId ?? randomUUID();
    await this.enqueueSmokePing.execute(correlationId);
    return { correlationId };
  }
}
