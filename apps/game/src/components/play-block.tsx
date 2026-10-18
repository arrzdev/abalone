import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import { buttonClassName } from "@/components/ui/button"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

export type PlayBlockProps = {
  /** The button's label: it opens the computer game. */
  cta: string
  /** The link's label: it goes home, to the choice of ways to play. */
  more: string
  /**
   * What the button does instead of opening the computer game. Online play
   * asks for an account first, so it is an action (the sign-in gate), not a
   * link to a hub a visitor would be sent back from.
   */
  onPlay?: () => void
}

/**
 * A way out of the text and onto a board, for a page somebody is reading about
 * the game (the `content-play-block` document on TUD-820).
 *
 * Links rather than buttons: they go somewhere, and a crawler follows an
 * `href`. The button is the computer game, because that is the one that needs
 * nobody and no account. The link beside it goes home and says so; it never
 * promises a game, because home is a choice and not one.
 *
 * On a phone the button is a thumb's width and the link sits under it. From
 * `sm` the two are a row under the text they follow. A longer label in some
 * languages takes two lines: the height grows with it rather than clipping it.
 */
export function PlayBlock({ cta, more, onPlay }: PlayBlockProps) {
  const ctaClassName = cn(
    buttonClassName("primary", "lg"),
    "h-auto min-h-[54px] w-full py-3 text-center text-balance sm:w-auto sm:px-8",
  )

  return (
    <div className="flex flex-col gap-y-1 sm:flex-row sm:items-center sm:gap-x-6">
      {onPlay && (
        <button type="button" onClick={onPlay} className={ctaClassName}>
          {cta}
        </button>
      )}
      {!onPlay && (
        <Link {...COMPUTER_GAME} className={ctaClassName}>
          {cta}
        </Link>
      )}
      <Link
        to="/"
        className={cn(
          TEXT_LINK_CLASS,
          "inline-flex min-h-11 items-center self-center sm:self-auto",
        )}
      >
        {more}
      </Link>
    </div>
  )
}
