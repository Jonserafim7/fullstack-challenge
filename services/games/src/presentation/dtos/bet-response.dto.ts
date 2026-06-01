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

  @ApiProperty({
    description:
      "Locked multiplier in integer hundredths (247 = 2.47x), set when the Bet is Cashed Out; null otherwise.",
    example: 247,
    nullable: true,
  })
  cashedOutMultiplier!: number | null;

  @ApiProperty({
    description:
      "Payout in integer cents (stake × locked multiplier) when Cashed Out; null otherwise.",
    example: 1235,
    nullable: true,
  })
  payoutCents!: number | null;
}

export function toBetResponse(bet: Bet): BetResponseDto {
  const cashedOutMultiplier = bet.cashedOutMultiplier;
  const payoutCents =
    cashedOutMultiplier !== null
      ? Number(bet.stake.times(cashedOutMultiplier).cents)
      : null;
  return {
    betId: bet.betId,
    roundNumber: bet.roundNumber,
    status: bet.status,
    stakeCents: Number(bet.stake.cents),
    cashedOutMultiplier,
    payoutCents,
  };
}
