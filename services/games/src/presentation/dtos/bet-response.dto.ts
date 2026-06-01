import { ApiProperty } from "@nestjs/swagger";
import { Bet, BetStatus } from "../../domain/entities/bet";

export class BetResponseDto {
  @ApiProperty({ description: "Server-assigned Bet id." })
  betId!: string;

  @ApiProperty({ description: "The Round this Bet belongs to.", example: 42 })
  roundNumber!: number;

  @ApiProperty({
    description:
      "Bet status. A placed Bet starts Pending and becomes Confirmed once the Wallet debit lands.",
    enum: Object.values(BetStatus),
    example: BetStatus.PENDING,
  })
  status!: BetStatus;

  @ApiProperty({ description: "Stake in integer cents.", example: 500 })
  stakeCents!: number;
}

export function toBetResponse(bet: Bet): BetResponseDto {
  return {
    betId: bet.betId,
    roundNumber: bet.roundNumber,
    status: bet.status,
    stakeCents: Number(bet.stake.cents),
  };
}
