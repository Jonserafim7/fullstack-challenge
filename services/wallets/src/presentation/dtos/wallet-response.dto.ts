import { ApiProperty } from "@nestjs/swagger";
import { Wallet } from "../../domain/entities/wallet";

export class WalletResponseDto {
  @ApiProperty({
    description: "The player's stable identifier (the JWT subject).",
    example: "11111111-1111-1111-1111-111111111111",
  })
  playerId!: string;

  @ApiProperty({
    description: "Current balance in integer minor units (cents).",
    example: 100000,
  })
  balance!: number;
}

export function toWalletResponse(wallet: Wallet): WalletResponseDto {
  return {
    playerId: wallet.playerId,
    balance: Number(wallet.balance.cents),
  };
}
