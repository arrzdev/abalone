import { Link, Screen } from "@repo/nativ/components"
import { Logo } from "@/components/logo"

export function NotFoundScreen() {
  return (
    <Screen className="box-border items-center justify-center gap-y-8 bg-background px-safe-offset-6 py-safe-offset-8 text-center text-foreground">
      <Logo className="w-20 opacity-70" />

      <h1 className="text-lg font-semibold">Nothing on this square</h1>
      <p className="max-w-xs text-balance text-sm text-muted">
        That address is not one of the game's screens.
      </p>

      <Link
        to="/"
        className="clickable inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground no-underline transition-transform duration-200 ease-out pressed:scale-[0.98] pressed:duration-0"
      >
        Back to the board
      </Link>
    </Screen>
  )
}

export default NotFoundScreen
