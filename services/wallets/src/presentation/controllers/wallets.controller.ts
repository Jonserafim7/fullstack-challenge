import {
  Controller,
  Get,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CreateWalletUseCase } from "../../application/create-wallet.use-case";
import { GetMyWalletUseCase } from "../../application/get-my-wallet.use-case";
import { WalletNotFoundError } from "../../application/wallet-not-found.error";
import { JwtAuthGuard } from "../../infrastructure/auth/jwt-auth.guard";
import { CurrentPlayer } from "../../infrastructure/auth/current-player.decorator";
import {
  toWalletResponse,
  WalletResponseDto,
} from "../dtos/wallet-response.dto";

@ApiTags("wallets")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
@Controller()
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(
    private readonly createWallet: CreateWalletUseCase,
    private readonly getMyWallet: GetMyWalletUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create the authenticated player's wallet",
    description:
      "Idempotent: returns 201 when the wallet is created, 200 when it already exists. The player is taken from the token subject.",
  })
  @ApiCreatedResponse({
    type: WalletResponseDto,
    description: "Wallet created.",
  })
  @ApiOkResponse({
    type: WalletResponseDto,
    description: "Wallet already existed.",
  })
  async create(
    @CurrentPlayer() playerId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WalletResponseDto> {
    const { wallet, created } = await this.createWallet.execute({ playerId });
    response.status(created ? 201 : 200);
    return toWalletResponse(wallet);
  }

  @Get("me")
  @ApiOperation({
    summary: "Get the authenticated player's wallet and balance",
  })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiNotFoundResponse({ description: "The player has no wallet yet." })
  async me(@CurrentPlayer() playerId: string): Promise<WalletResponseDto> {
    try {
      const wallet = await this.getMyWallet.execute({ playerId });
      return toWalletResponse(wallet);
    } catch (error) {
      if (error instanceof WalletNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
