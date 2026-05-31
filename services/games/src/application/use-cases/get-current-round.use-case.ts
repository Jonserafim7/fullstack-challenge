import { Injectable } from "@nestjs/common";
import { Round } from "../../domain/entities/round";
import { RoundRepository } from "../repositories/round.repository";

@Injectable()
export class GetCurrentRoundUseCase {
  constructor(private readonly rounds: RoundRepository) {}

  async execute(): Promise<Round | null> {
    return this.rounds.findCurrent();
  }
}
