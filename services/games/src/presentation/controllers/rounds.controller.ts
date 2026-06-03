import {
  ConflictException,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { RoundNotVerifiableError } from "../../application/errors/round-not-verifiable.error";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "../../application/use-cases/get-round-history.use-case";
import { GetRoundVerificationUseCase } from "../../application/use-cases/get-round-verification.use-case";
import {
  RoundHistoryResponseDto,
  toRoundHistoryResponse,
} from "../dtos/round-history-response.dto";
import { RoundResponseDto, toRoundResponse } from "../dtos/round-response.dto";
import {
  RoundVerificationResponseDto,
  toRoundVerificationResponse,
} from "../dtos/round-verification-response.dto";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

// Watching the game is public, so these endpoints carry no auth guard (ADR-0003): a client
// hydrates the current Round here on connect, then receives deltas over WebSocket.
@ApiTags("rounds")
@Controller()
export class RoundsController {
  constructor(
    private readonly getCurrentRound: GetCurrentRoundUseCase,
    private readonly getRoundHistory: GetRoundHistoryUseCase,
    private readonly getRoundVerification: GetRoundVerificationUseCase,
  ) {}

  @Get("rounds/current")
  @ApiOperation({ summary: "Snapshot of the Round currently in progress" })
  @ApiOkResponse({ type: RoundResponseDto })
  @ApiNotFoundResponse({ description: "No Round has started yet." })
  async current(): Promise<RoundResponseDto> {
    const round = await this.getCurrentRound.execute();
    if (!round) {
      throw new NotFoundException("No Round has started yet");
    }
    return toRoundResponse(round);
  }

  @Get("rounds/history")
  @ApiOperation({ summary: "Paginated history of terminal Rounds" })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, example: DEFAULT_PAGE_SIZE })
  @ApiOkResponse({ type: RoundHistoryResponseDto })
  async history(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe)
    pageSize: number,
  ): Promise<RoundHistoryResponseDto> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    const { rounds, total } = await this.getRoundHistory.execute({
      page: safePage,
      pageSize: safePageSize,
    });
    return toRoundHistoryResponse({
      rounds,
      total,
      page: safePage,
      pageSize: safePageSize,
    });
  }

  @Get("rounds/:roundNumber/verify")
  @ApiOperation({
    summary: "Provably-fair verification data for a past Round",
    description:
      "Returns the revealed Server Seed, the Commitment it chains to (previousSeed), the Client Seed, the house edge, and the Crash Point, so anyone can confirm SHA256(serverSeed) == previousSeed and recompute the Crash Point (ADR-0002).",
  })
  @ApiOkResponse({ type: RoundVerificationResponseDto })
  @ApiNotFoundResponse({ description: "No such Round." })
  @ApiConflictResponse({
    description:
      "The Round has not crashed yet; its Server Seed is not revealed.",
  })
  async verify(
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
  ): Promise<RoundVerificationResponseDto> {
    try {
      const round = await this.getRoundVerification.execute({ roundNumber });
      if (!round) {
        throw new NotFoundException(`No Round ${roundNumber}`);
      }
      return toRoundVerificationResponse(round);
    } catch (error) {
      if (error instanceof RoundNotVerifiableError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
