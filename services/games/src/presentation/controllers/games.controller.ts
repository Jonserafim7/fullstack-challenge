import { Controller, Get } from "@nestjs/common";
import type { HealthCheckResponseDto } from "../dtos/health-check-response.dto";

@Controller()
export class GamesController {
  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }
}
