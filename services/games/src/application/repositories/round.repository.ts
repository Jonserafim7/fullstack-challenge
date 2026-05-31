import { Round } from "../../domain/entities/round";

export abstract class RoundRepository {
  abstract save(round: Round): Promise<void>;
  abstract findCurrent(): Promise<Round | null>;
  abstract findHistory(params: {
    limit: number;
    offset: number;
  }): Promise<{ rounds: Round[]; total: number }>;
  abstract maxRoundNumber(): Promise<number>;
}
