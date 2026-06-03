import { Injectable } from "@nestjs/common";
import { Round } from "../../domain/entities/round";
import { RoundNotVerifiableError } from "../errors/round-not-verifiable.error";
import { RoundRepository } from "../repositories/round.repository";

// Returns a past Round so its provably-fair result can be independently verified. The Server
// Seed is only revealed once the Round is terminal (Crashed/Settled); requesting an earlier Round
// raises RoundNotVerifiableError. A missing Round resolves to null (the controller answers 404).
@Injectable()
export class GetRoundVerificationUseCase {
  constructor(private readonly rounds: RoundRepository) {}

  async execute({
    roundNumber,
  }: {
    roundNumber: number;
  }): Promise<Round | null> {
    const round = await this.rounds.findByNumber(roundNumber);
    if (!round) {
      return null;
    }
    if (!round.isTerminal) {
      throw new RoundNotVerifiableError(roundNumber);
    }
    return round;
  }
}
