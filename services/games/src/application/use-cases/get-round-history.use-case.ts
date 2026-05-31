import { Injectable } from "@nestjs/common";
import { Round } from "../../domain/entities/round";
import { RoundRepository } from "../repositories/round.repository";

@Injectable()
export class GetRoundHistoryUseCase {
  constructor(private readonly rounds: RoundRepository) {}

  async execute({
    page,
    pageSize,
  }: {
    page: number;
    pageSize: number;
  }): Promise<{ rounds: Round[]; total: number }> {
    return this.rounds.findHistory({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
}
