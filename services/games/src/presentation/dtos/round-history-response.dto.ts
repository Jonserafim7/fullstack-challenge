import { ApiProperty } from "@nestjs/swagger";
import { Round } from "../../domain/entities/round";
import { RoundResponseDto, toRoundResponse } from "./round-response.dto";

export class RoundHistoryResponseDto {
  @ApiProperty({ type: [RoundResponseDto] })
  rounds!: RoundResponseDto[];

  @ApiProperty({
    description: "Total terminal Rounds available.",
    example: 137,
  })
  total!: number;

  @ApiProperty({ description: "Current page (1-based).", example: 1 })
  page!: number;

  @ApiProperty({ description: "Rounds per page.", example: 20 })
  pageSize!: number;
}

export function toRoundHistoryResponse({
  rounds,
  total,
  page,
  pageSize,
}: {
  rounds: Round[];
  total: number;
  page: number;
  pageSize: number;
}): RoundHistoryResponseDto {
  return {
    rounds: rounds.map(toRoundResponse),
    total,
    page,
    pageSize,
  };
}
