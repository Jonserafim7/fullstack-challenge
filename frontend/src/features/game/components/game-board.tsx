import { useRoundSocket } from "../use-round-socket";
import { MultiplierStage } from "./multiplier-stage";
import { HistoryStrip } from "./history-strip";
import { BetPanel } from "./bet-panel";
import { ParticipantsList } from "./participants-list";
import { BetHistory } from "./bet-history";

// The board inside the app shell. Two columns from 900px up — left ("a rodada"): the stage + recent
// crash points; right ("apostas"): the bet/cash-out hero, the live round participants, and the
// player's own bet history. Below 900px the columns flatten (display:contents) into one stream and
// the `order` utilities reorder it so the bet/cash-out control sits right under the stage, never
// buried below the participants list.
export function GameBoard() {
  useRoundSocket();

  return (
    <div className="flex flex-col gap-4 p-4 min-[900px]:grid min-[900px]:grid-cols-[3fr_2fr] min-[900px]:items-start">
      <div className="contents min-[900px]:flex min-[900px]:min-w-0 min-[900px]:flex-col min-[900px]:gap-4">
        <MultiplierStage className="order-1" />
        <HistoryStrip className="order-4" />
      </div>
      <div className="contents min-[900px]:flex min-[900px]:min-w-0 min-[900px]:flex-col min-[900px]:gap-4">
        <BetPanel className="order-2" />
        <ParticipantsList className="order-3" />
        <BetHistory className="order-5" />
      </div>
    </div>
  );
}
