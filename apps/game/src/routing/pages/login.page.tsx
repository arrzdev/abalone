import { Screen, ScrollView } from "@repo/nativ/components"
import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { AuthForm } from "@/components/auth-form"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { hasLiveSession } from "@/data/auth/client"
import { getBearerToken } from "@/data/auth/token"
import type { ReturnTo } from "@/routing/return-to"
import {
  DEFAULT_RETURN_TO,
  parseReturnTo,
  returnToOptions,
} from "@/routing/return-to"

export type LoginSearch = {
  /** Where to go once signed in. Anything unrecognised is dropped. */
  redirect?: ReturnTo
}

/**
 * Sign in, or make an account, on a screen of its own.
 *
 * This is the desktop shape of the prompt — a phone gets the same form in a
 * drawer (`AuthPromptProvider`) and mostly lands here by typing the URL. Which
 * is why the screen is built as a split: a desktop has a screenful of room, and
 * a small card marooned in the middle of it is a phone layout nobody resized.
 *
 * A guest is never made to wait: no token means the form, immediately. A token
 * costs one round trip, because the string in storage is not proof — one the
 * server no longer honours is dropped and the form renders, rather than
 * bouncing someone home from the only screen that can sign them back in.
 */
export const Route = createFileRoute("/_subpage/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: parseReturnTo(search.redirect),
  }),
  beforeLoad: async ({ search }) => {
    if (!getBearerToken()) return
    if (!(await hasLiveSession())) return
    throw redirect({
      ...returnToOptions(search.redirect ?? DEFAULT_RETURN_TO),
      replace: true,
    })
  },
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { redirect: returnTo } = Route.useSearch()

  //the same split the drawer makes: online play has a reason it needs a name,
  //and anywhere else the form speaks for itself
  const forOnlinePlay = returnTo === "/game/online"

  return (
    <>
      {/* The only chrome a phone gets here, and the only way back off a screen
        that has no tab bar under it. The title is the bar's job rather than the
        form's — see the heading below, which is the desktop's. */}
      <SubpageHeader title={t("common:auth.sign_in")} />

      <Screen className="relative overflow-hidden lg:flex-row">
        {/* One surface, one pattern across the whole of it. The screen used to be
          two panels in two greys with a seam down the middle, which made the
          form look like a sidebar bolted onto a page. The honeycomb is what
          separates the halves now: thick where the pictures are and gone by the
          time it reaches the fields. */}
        <div className="hex-texture hex-texture-from-right pointer-events-none absolute inset-0 opacity-[0.07] [--hex-size:76px]" />

        <ScrollView className="relative px-safe" directionalLockEnabled>
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-y-8 px-6 pt-10 pb-safe-offset-10 lg:px-12">
            {/* No "Sign in" over the top of a switch whose left half already says
              it. The only heading worth the room is the one that answers a
              question the form raises — why it is asking at all, on the width
              that has room to spare. A phone gets the form and nothing else:
              it is one screenful either way, and everything else on it is a
              reason to scroll for the fields. */}
            {forOnlinePlay && (
              <div className="hidden flex-col gap-y-2 lg:flex">
                <h1 className="text-3xl font-extrabold tracking-tight text-white">
                  {t("common:auth.prompt_title")}
                </h1>
                <p className="leading-relaxed text-white/50">
                  {t("common:auth.prompt_body")}
                </p>
              </div>
            )}

            <AuthForm
              onAuthenticated={() =>
                navigate({
                  ...returnToOptions(returnTo ?? DEFAULT_RETURN_TO),
                  replace: true,
                })
              }
            />
          </div>
        </ScrollView>

        {/* The half of the screen the form does not need, spent on what the
          account is for: the game, on both of the things it runs on. */}
        <aside className="relative hidden min-h-0 flex-1 flex-col justify-center gap-y-10 p-10 lg:flex">
          <Showcase />

          <p className="max-w-md text-xl leading-snug font-bold text-balance text-white/80">
            {t("common:home.tagline")}
          </p>
        </aside>
      </Screen>
    </>
  )
}

const SHOT_BASE = `${import.meta.env.BASE_URL}images/showcase`

/**
 * The game as it actually looks, on a desktop and on a phone, the phone
 * overlapping the corner of the desktop.
 *
 * Both are real screenshots rather than a drawing of one: the point of the
 * panel is "this is the thing you are signing into", and a mockup with invented
 * content says the opposite. They are captured by hand from the running app, so
 * they go stale — the frames are the part worth keeping, and swapping the two
 * files is the whole of updating this.
 *
 * The frames are drawn in CSS rather than baked into the images: a bezel is two
 * rounded boxes, and baking it in would mean re-editing artwork every time the
 * screenshot changes.
 */
function Showcase() {
  return (
    <div className="relative mx-auto w-full max-w-xl pb-10 ps-10">
      <div className="overflow-hidden rounded-xl bg-surface-4 shadow-2xl shadow-black/50 ring-1 ring-white/10">
        <div className="flex h-7 items-center gap-1.5 bg-surface-3 px-3">
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/10" />
        </div>
        <img
          src={`${SHOT_BASE}/desktop.webp`}
          alt=""
          className="block w-full"
        />
      </div>

      <div className="absolute bottom-0 left-0 w-[26%] rounded-[1.4rem] bg-black p-1 shadow-2xl shadow-black/60 ring-1 ring-white/15">
        <img
          src={`${SHOT_BASE}/mobile.webp`}
          alt=""
          className="block w-full rounded-[1.1rem]"
        />
      </div>
    </div>
  )
}
