# Crash Game

Domain glossary for the crash game: a real-time multiplayer betting game where a multiplier rises from `1.00x` and crashes at a predetermined point. Players bet during a betting window and must cash out before the crash to win.

This is the project's shared language. Use these terms exactly; avoid the synonyms listed under _Avoid_.

## Round lifecycle

**Round**:
One play cycle of the game, from open betting to settled results. Owns the crash point and the bets placed in it.
_Avoid_: game, match, game round

**Betting**:
The Round state where the betting window is open and players may place bets; the multiplier has not started.
_Avoid_: open, waiting, lobby

**Running**:
The Round state where the multiplier is rising from `1.00x`. Cashouts are allowed; new bets are not.
_Avoid_: active, playing, in-progress

**Crashed**:
The Round state from the instant the multiplier reaches the crash point and stops. No further cashouts.
_Avoid_: ended, stopped, busted

**Settled**:
The Round state after all bets have been resolved, balances updated, and verification data exposed. The Round is final.
_Avoid_: closed, finished, complete

## Bets

**Bet**:
A single player's wager on one Round. At most one per player per Round.
_Avoid_: wager, stake (the *stake* is the bet's amount, not the bet itself), entry

**Pending**:
A Bet that has been placed but whose debit the Wallet has not yet confirmed. Provisional — not yet a real participant in the Round.
_Avoid_: placed, awaiting, processing

**Confirmed**:
A Bet whose stake the Wallet has debited. The player is now a real participant in the Round.
_Avoid_: accepted, active, valid

**Rejected**:
A Bet the Wallet refused to debit (insufficient balance) or that violated a Round rule. Never counted as a participant.
_Avoid_: failed, denied, declined

**Cashed Out**:
A Confirmed Bet whose player locked in a multiplier during Running. A winning, terminal Bet.
_Avoid_: won, withdrawn, collected

**Lost**:
A Confirmed Bet that never cashed out before the Round crashed. A losing, terminal Bet.
_Avoid_: busted, missed, expired

**Voided**:
A Bet that was placed in time but not Confirmed before the Round left Betting. Never participated; a terminal Bet that owes a Refund if its debit later lands.
_Avoid_: cancelled, annulled, timed-out

## Actors

**Player**:
A participant identified by the subject of their JWT. Owns exactly one Wallet.
_Avoid_: user, account, gambler

**Wallet**:
A Player's single store of money and the source of truth for their funds. Lives in the wallets service.
_Avoid_: account, balance (the *balance* is the amount held; the Wallet is the thing that holds it)

## Money

**Stake**:
The amount a Bet wagers.
_Avoid_: bet amount, wager

**Cashout**:
The action of a Player locking in the current multiplier during Running, before the crash.
_Avoid_: withdraw, redeem, collect

**Payout**:
The money credited to a Wallet on cashout, equal to stake × the locked multiplier.
_Avoid_: winnings, prize, reward

**Refund**:
A credit that returns a previously debited stake to a Wallet, compensating a Voided Bet.
_Avoid_: reversal, chargeback, rollback

## Gameplay

**Multiplier**:
The value rising continuously from `1.00x` during Running.
_Avoid_: odds, rate, coefficient

**Crash Point**:
The predetermined multiplier at which a Round stops and enters Crashed. Fixed before betting opens and independently verifiable afterward.
_Avoid_: bust point, crash multiplier, end point

## Provably fair

**Server Seed**:
A secret value, one per Round, that determines its crash point. Revealed after the Round so the result can be verified.
_Avoid_: server secret, game seed

**Client Seed**:
A public value combined with the server seed to derive the crash point, so the operator cannot grind the chain in the house's favor.
_Avoid_: salt, nonce, player seed

**Commitment**:
The genesis hash of the server-seed chain, published before any Round runs, that locks every future crash point in advance.
_Avoid_: seal, commit hash

**Hash Chain**:
The backward-linked sequence of server seeds, each the SHA-256 of the next, whose genesis is the Commitment.
_Avoid_: seed chain

**House Edge**:
The house's statistical advantage, applied as the probability that a Round crashes instantly at `1.00x`. The return to player is `1 − house edge`.
_Avoid_: margin, vig, rake
