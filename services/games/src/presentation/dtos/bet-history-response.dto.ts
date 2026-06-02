import { ApiProperty } from "@nestjs/swagger";
import { Bet } from "../../domain/entities/bet";
import { BetResponseDto, toBetResponse } from "./bet-response.dto";

export class BetHistoryResponseDto {
  @ApiProperty({ type: [BetResponseDto] })
  bets!: BetResponseDto[];

  @ApiProperty({
    description: "Total Bets the player has placed.",
    example: 137,
  })
  total!: number;

  @ApiProperty({ description: "Current page (1-based).", example: 1 })
  page!: number;

  @ApiProperty({ description: "Bets per page.", example: 20 })
  pageSize!: number;
}

export function toBetHistoryResponse({
  bets,
  total,
  page,
  pageSize,
}: {
  bets: Bet[];
  total: number;
  page: number;
  pageSize: number;
}): BetHistoryResponseDto {
  return {
    bets: bets.map(toBetResponse),
    total,
    page,
    pageSize,
  };
}
