import type { CellName } from "@/engine/types"

/** One played move: the line that was picked up, and the square it moved onto. */
export type DemoMove = {
  marbles: CellName[]
  to: CellName
}

/**
 * A whole game, played out in advance.
 *
 * The home page replays this through the real board rather than searching for
 * moves live: a bot strong enough to be worth watching is a bot that thinks, and
 * the front door is the last place to spend a phone's battery on it. Generated
 * once from the engine's own search (levels 4 and 3), so every move here is one
 * the game would actually play, and it ends three captures each — even, and with
 * marbles going off both edges.
 */
export const DEMO_GAME: DemoMove[] = [
  { marbles: ["2,-2", "3,-3", "4,-4"], to: "1,-1" },
  { marbles: ["-4,4", "-3,3", "-2,2"], to: "-1,1" },
  { marbles: ["2,0", "3,0", "4,0"], to: "1,0" },
  { marbles: ["-4,0", "-3,0", "-2,0"], to: "-1,0" },
  { marbles: ["1,-1", "2,-2", "3,-3"], to: "0,0" },
  { marbles: ["-4,2", "-3,2", "-2,2"], to: "-1,2" },
  { marbles: ["4,-2", "3,-1", "2,0"], to: "1,1" },
  { marbles: ["-1,2"], to: "0,2" },
  { marbles: ["3,-2", "2,-1", "1,0"], to: "0,1" },
  { marbles: ["-3,1", "-2,1", "-1,1"], to: "0,1" },
  { marbles: ["1,-1", "2,-1", "3,-1"], to: "0,-1" },
  { marbles: ["-1,0", "-2,1", "-3,2"], to: "0,-1" },
  { marbles: ["1,0", "2,-1"], to: "0,1" },
  { marbles: ["-3,-1", "-3,0"], to: "-3,1" },
  { marbles: ["4,-3"], to: "3,-2" },
  { marbles: ["-3,4", "-3,3"], to: "-3,2" },
  { marbles: ["4,-1"], to: "3,-1" },
  { marbles: ["-4,3", "-3,3"], to: "-2,3" },
  { marbles: ["1,1", "2,0", "3,-1"], to: "0,2" },
  { marbles: ["-3,2", "-2,2", "-1,2"], to: "0,2" },
  { marbles: ["3,-2"], to: "2,-1" },
  { marbles: ["-4,1", "-3,0"], to: "-2,-1" },
  { marbles: ["0,1", "1,0", "2,-1"], to: "-1,2" },
  { marbles: ["-3,3", "-3,4"], to: "-3,2" },
  { marbles: ["0,1", "-1,2"], to: "-2,3" },
  { marbles: ["-1,1", "-2,1", "-3,1"], to: "0,1" },
  { marbles: ["-1,2", "-2,3"], to: "-3,4" },
  { marbles: ["-3,2", "-3,3"], to: "-3,4" },
  { marbles: ["3,-4"], to: "2,-3" },
  { marbles: ["0,-1", "-1,0", "-2,1"], to: "1,-2" },
  { marbles: ["3,1", "2,1", "1,1"], to: "0,1" },
  { marbles: ["1,-2", "0,-1", "-1,0"], to: "2,-3" },
  { marbles: ["2,1", "1,1", "0,1"], to: "-1,1" },
  { marbles: ["2,-3", "1,-2"], to: "3,-4" },
  { marbles: ["1,1", "0,1", "-1,1"], to: "-2,1" },
  { marbles: ["3,-4", "2,-3"], to: "1,-2" },
  { marbles: ["0,1", "-1,1", "-2,1"], to: "-3,1" },
  { marbles: ["-2,0", "-3,0"], to: "-1,0" },
  { marbles: ["-2,1", "-3,1"], to: "-4,1" },
  { marbles: ["-1,3", "0,2"], to: "0,1" },
]
