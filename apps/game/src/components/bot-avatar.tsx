import type { ComponentType, SVGProps } from "react"
import { ClaraAvatar } from "@/components/avatars/clara.gen"
import { GusAvatar } from "@/components/avatars/gus.gen"
import { IrisAvatar } from "@/components/avatars/iris.gen"
import { MagnusAvatar } from "@/components/avatars/magnus.gen"
import { MiloAvatar } from "@/components/avatars/milo.gen"
import { NoraAvatar } from "@/components/avatars/nora.gen"
import { TheoAvatar } from "@/components/avatars/theo.gen"
import { VictorAvatar } from "@/components/avatars/victor.gen"
import { getBot } from "@/i18n/bots"

/**
 * Which face belongs to which character.
 *
 * Keyed by the character's id and not by their level, for the reason the ids
 * exist at all: reordering the ladder should move a face up it rather than
 * repaint someone else's.
 */
const PORTRAITS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  gus: GusAvatar,
  milo: MiloAvatar,
  nora: NoraAvatar,
  theo: TheoAvatar,
  iris: IrisAvatar,
  victor: VictorAvatar,
  clara: ClaraAvatar,
  magnus: MagnusAvatar,
}

export interface BotAvatarProps extends SVGProps<SVGSVGElement> {
  /** The ladder position whose character to draw. */
  level: number
}

/**
 * The portrait of whoever sits at a level.
 *
 * Drawn inline rather than fetched, so a face is on screen in the frame it is
 * asked for — the opponent grid puts all eight up at once and used to show
 * eight empty tiles until the images landed.
 *
 * The art is square, so it fills whatever box the caller sizes: pass the size
 * as a class, the way `Logo` takes one.
 *
 * Falls back to the first character the same way `getBot` does, so a level
 * added to the ladder before its portrait exists draws a face rather than a
 * hole.
 */
export function BotAvatar({ level, ...props }: BotAvatarProps) {
  const Portrait = PORTRAITS[getBot(level).id] || GusAvatar
  return <Portrait {...props} />
}
