import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { BetAlreadyPlacedError } from "../../application/errors/bet-already-placed.error";
import { BettingClosedError } from "../../application/errors/betting-closed.error";
import { InvalidStakeError } from "../../application/errors/invalid-stake.error";
import { GetBetUseCase } from "../../application/use-cases/get-bet.use-case";
import { PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import {
  CurrentPlayer,
  CurrentUsername,
} from "../../infrastructure/auth/current-player.decorator";
import { JwtAuthGuard } from "../../infrastructure/auth/jwt-auth.guard";
import { PlaceBetRequestDto } from "../dtos/place-bet-request.dto";
import { BetResponseDto, toBetResponse } from "../dtos/bet-response.dto";

// Kong strips the /games prefix, so these routes are POST /games/bet and GET /games/bets/:betId.
@ApiTags("bets")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
@Controller()
@UseGuards(JwtAuthGuard)
export class BetsController {
  constructor(
    private readonly placeBet: PlaceBetUseCase,
    private readonly getBet: GetBetUseCase,
  ) {}

  @Post("bet")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Place a Bet on the current Round",
    description:
      "Optimistic saga (ADR-0001): creates a Pending Bet and returns 202 immediately. The stake is debited asynchronously; the Confirmed outcome arrives over WebSocket (bet.confirmed).",
  })
  @ApiAcceptedResponse({
    type: BetResponseDto,
    description: "Bet placed (Pending).",
  })
  @ApiBadRequestResponse({ description: "Stake outside the allowed range." })
  @ApiConflictResponse({
    description: "Betting is closed, or the player already bet this Round.",
  })
  async place(
    @CurrentPlayer() playerId: string,
    @CurrentUsername() username: string,
    @Body() body: PlaceBetRequestDto,
  ): Promise<BetResponseDto> {
    try {
      const bet = await this.placeBet.execute({
        playerId,
        username,
        stakeCents: body.stakeCents,
      });
      return toBetResponse(bet);
    } catch (error) {
      if (error instanceof InvalidStakeError) {
        throw new BadRequestException(error.message);
      }
      if (
        error instanceof BettingClosedError ||
        error instanceof BetAlreadyPlacedError
      ) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Get("bets/:betId")
  @ApiOperation({ summary: "Read one of the caller's own Bets" })
  @ApiOkResponse({ type: BetResponseDto })
  @ApiNotFoundResponse({ description: "No such Bet for this player." })
  async getOne(
    @CurrentPlayer() playerId: string,
    @Param("betId") betId: string,
  ): Promise<BetResponseDto> {
    const bet = await this.getBet.execute({ betId, playerId });
    if (!bet) {
      throw new NotFoundException("No such Bet for this player");
    }
    return toBetResponse(bet);
  }
}
