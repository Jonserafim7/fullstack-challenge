import { Injectable } from "@nestjs/common";
import { Round } from "../../domain/entities/round";
import { RoundNotVerifiableError } from "../errors/round-not-verifiable.error";
import { RoundRepository } from "../repositories/round.repository";

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
