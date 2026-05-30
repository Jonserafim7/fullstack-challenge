import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";

@ApiTags("health")
@Controller()
export class HealthController {
  @Get("health")
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }
}
