import { ApiProperty } from "@nestjs/swagger";

export class PlaceBetRequestDto {
  @ApiProperty({
    description:
      "Stake in integer cents (100–100000 = R$1,00–R$1.000,00). Money is never a float (ADR-0004).",
    example: 500,
    minimum: 100,
    maximum: 100000,
  })
  stakeCents!: number;
}
