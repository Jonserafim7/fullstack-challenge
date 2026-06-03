import { beforeEach, describe, expect, test } from "bun:test";
import { useBetStore } from "./bet-store";
import { BetStatus } from "./round-contracts";

const store = () => useBetStore.getState();

function placeFreshBet() {
  store().placePending({
    betId: "b1",
    roundNumber: 1,
    stakeCents: 1_000,
    status: BetStatus.PENDING,
  });
}

describe("bet store", () => {
  beforeEach(() => useBetStore.setState({ bet: null }));

  test("placePending stores a fresh Pending bet", () => {
    placeFreshBet();
    expect(store().bet?.betId).toBe("b1");
    expect(store().bet?.status).toBe(BetStatus.PENDING);
    expect(store().bet?.cashedOutMultiplier).toBeNull();
  });

  test("confirm flips only the matching bet", () => {
    placeFreshBet();
    store().confirm("other");
    expect(store().bet?.status).toBe(BetStatus.PENDING);
    store().confirm("b1");
    expect(store().bet?.status).toBe(BetStatus.CONFIRMED);
  });

  test("cashOut only applies to a Confirmed bet and is idempotent", () => {
    placeFreshBet();
    // A Pending bet cannot cash out.
    store().cashOut({
      betId: "b1",
      cashedOutMultiplier: 200,
      payoutCents: 2_000,
    });
    expect(store().bet?.status).toBe(BetStatus.PENDING);

    store().confirm("b1");
    store().cashOut({
      betId: "b1",
      cashedOutMultiplier: 200,
      payoutCents: 2_000,
    });
    expect(store().bet?.status).toBe(BetStatus.CASHED_OUT);
    expect(store().bet?.payoutCents).toBe(2_000);

    // A second cash out is a no-op — the first locked multiplier stands.
    store().cashOut({
      betId: "b1",
      cashedOutMultiplier: 999,
      payoutCents: 9_999,
    });
    expect(store().bet?.cashedOutMultiplier).toBe(200);
  });

  test("reject flips only the matching bet", () => {
    placeFreshBet();
    store().reject("other");
    expect(store().bet?.status).toBe(BetStatus.PENDING);
    store().reject("b1");
    expect(store().bet?.status).toBe(BetStatus.REJECTED);
  });
});
