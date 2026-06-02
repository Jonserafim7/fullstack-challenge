import { ApiProperty } from "@nestjs/swagger";
import { Round } from "../../domain/entities/round";

// Everything a player needs to independently verify a past Round (ADR-0002): hash the Server Seed
// to confirm the chain link to previousSeed, then recompute the Crash Point from the seeds and
// house edge. Exposed publicly once the Round has Crashed.
export class RoundVerificationResponseDto {
  @ApiProperty({ description: "The Round being verified.", example: 137 })
  roundNumber!: number;

  @ApiProperty({
    description:
      "The revealed Server Seed that determined this Round's Crash Point.",
  })
  serverSeed!: string;

  @ApiProperty({
    description:
      "The Commitment this Round chains to: SHA256(serverSeed) must equal it. The previous Round's revealed seed, or the genesis Commitment for Round 1. Null for Rounds recorded before this was persisted.",
    nullable: true,
  })
  previousSeed!: string | null;

  @ApiProperty({
    description: "The public Client Seed mixed into the derivation.",
  })
  clientSeed!: string;

  @ApiProperty({
    description: "The house-edge fraction (the instant-bust probability).",
    example: 0.01,
  })
  houseEdge!: number;

  @ApiProperty({
    description:
      "The resulting Crash Point in integer hundredths (247 = 2.47x).",
    example: 247,
  })
  crashPoint!: number;
}

export function toRoundVerificationResponse(
  round: Round,
): RoundVerificationResponseDto {
  return {
    roundNumber: round.roundNumber,
    serverSeed: round.serverSeed,
    previousSeed: round.seedHash,
    clientSeed: round.clientSeed,
    houseEdge: round.houseEdge,
    crashPoint: round.crashPointHundredths,
  };
}
