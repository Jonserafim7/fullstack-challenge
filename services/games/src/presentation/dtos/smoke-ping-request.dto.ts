import { ApiPropertyOptional } from "@nestjs/swagger";

export class SmokePingRequestDto {
  @ApiPropertyOptional({
    description:
      "Correlation id echoed through the smoke round-trip. Generated when omitted.",
    example: "smoke-1",
  })
  correlationId?: string;
}
