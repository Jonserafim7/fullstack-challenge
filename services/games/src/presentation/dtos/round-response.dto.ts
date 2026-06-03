import { ApiProperty } from "@nestjs/swagger";
import { Round, RoundPhase } from "../../domain/entities/round";

export class RoundResponseDto {
  @ApiProperty({ description: "Monotonic Round number.", example: 42 })
  roundNumber!: number;

  @ApiProperty({
    description: "Current Round phase.",
    enum: Object.values(RoundPhase),
    example: RoundPhase.RUNNING,
  })
  phase!: RoundPhase;

  @ApiProperty({
    description:
      "Crash Point in integer hundredths (247 = 2.47x). Revealed only once the Round has Crashed; null while Betting or Running.",
    example: 247,
    nullable: true,
  })
  crashPoint!: number | null;

  @ApiProperty({
    description: "When the Betting window closes (ISO 8601).",
    nullable: true,
  })
  bettingEndsAt!: string | null;

  @ApiProperty({
    description: "When the Round started Running (ISO 8601).",
    nullable: true,
  })
  startedAt!: string | null;

  @ApiProperty({
    description: "When the Round Crashed (ISO 8601).",
    nullable: true,
  })
  crashedAt!: string | null;
}

// Crash Point is null until the round is terminal — revealing it early would expose the outcome.
export function toRoundResponse(round: Round): RoundResponseDto {
  return {
    roundNumber: round.roundNumber,
    phase: round.phase,
    crashPoint: round.isTerminal ? round.crashPointHundredths : null,
    bettingEndsAt: round.bettingEndsAt?.toISOString() ?? null,
    startedAt: round.startedAt?.toISOString() ?? null,
    crashedAt: round.crashedAt?.toISOString() ?? null,
  };
}
