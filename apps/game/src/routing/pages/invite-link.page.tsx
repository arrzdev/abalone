import { Link, Screen } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Logo } from "@/components/logo"
import type { HandOffStatus } from "@/components/online/share-link-button"
import { ShareLinkButton } from "@/components/online/share-link-button"
import { Button, buttonClassName } from "@/components/ui/button"
import { StatusLine } from "@/components/ui/status-line"
import { acceptInviteLinkMutationOptions } from "@/data/online/mutations"
import { inviteLinkQueryOptions, onlineKeys } from "@/data/online/queries"
import { useApiError } from "@/hooks/use-api-error"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"
import { useAuth } from "@/providers/auth-provider"
import { queryClient } from "@/providers/query-client"
import { inviteCard } from "@/routing/invite-card"
import { pageHead } from "@/routing/page-head"
import { BRAND } from "@/utils/brand"

export const Route = createFileRoute("/_subpage/invite/$linkId")({
  //read before the head is written, so the tab, the history entry and a share
  //sheet name who sent it. it never throws: a link that cannot be read still
  //gets a page, and the page says why.
  loader: async ({ params }) => {
    const options = inviteLinkQueryOptions(params.linkId)
    await queryClient.prefetchQuery(options)
    const link = queryClient.getQueryData(options.queryKey)
    //a spent link names nobody in the head, as on the server's card
    return {
      openInviterName:
        link?.state === "open" ? (link.inviterName ?? null) : null,
    }
  },
  //the same card the game Worker writes for a chat app (src/server/invite-page.ts)
  head: ({ loaderData, params }) =>
    pageHead({
      ...inviteCard(loaderData?.openInviterName ?? null),
      fullTitle: true,
      path: `/invite/${params.linkId}`,
      noIndex: true,
    }),
  component: InviteLinkPage,
})

const ACTION_CLASS = "w-full"

/** What a press on Accept can come back with, for its line to hold room for. */
const ACCEPT_ERRORS = [
  "errors:api_invite_link_own",
  "errors:api_invite_link_used",
  "errors:api_invite_link_expired",
  "errors:api_rate_limit_exceeded",
  "errors:api_service_unavailable",
  "errors:network_unreachable",
  "errors:unknown",
] as const

//`break-words`: a name is one unbroken word, and twenty characters of it at
//this size is wider than a small phone
const TITLE_CLASS =
  "mt-6 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] break-words text-balance text-white lg:text-[30px]"

const BODY_CLASS =
  "mt-3 text-[15px] leading-relaxed text-balance text-muted"

const PLAY_CLASS = cn(
  buttonClassName("primary", "lg"),
  "w-full no-underline",
)

//a text link, not a second button: the page has one thing to do. the padding
//is the 44×44 tap area around a word
const GO_HOME_CLASS =
  "clickable inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-4 text-[15px] font-semibold text-muted underline-offset-4 transition-colors duration-200 ease-out hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"

/**
 * Where an invite link opens, for whoever opens it.
 *
 * Public on purpose. The person it was sent to usually has no account yet, and
 * a link that answers "sign in first" before saying who sent it is a link
 * nobody follows. So it reads the one thing anybody may know, the sender's name
 * and whether the link still works, and only asks for an account at the moment
 * of saying yes. Signing up from here comes back here, to the same link.
 *
 * A link that cannot be taken is not a dead end: it offers a game against the
 * computer in one tap, and home as the quiet way out. Used, expired and broken
 * read differently because what to do about the link differs: one was taken by
 * somebody else, one just ran out, and one never worked (a paste cut short, or
 * an id nobody issued), so it never says "expired".
 */
function InviteLinkPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const translateError = useApiError()
  const { linkId } = Route.useParams()
  const { user, isPending: isAuthPending } = useAuth()
  const { requireAuth } = useAuthPrompt()
  const handOffId = useId()
  const [handOff, setHandOff] = useState<HandOffStatus>("idle")

  const link = useQuery(inviteLinkQueryOptions(linkId))

  const accept = useMutation({
    ...acceptInviteLinkMutationOptions,
    onSuccess: async ({ gameId }) => {
      await client.invalidateQueries({
        queryKey: onlineKeys.games("active"),
      })
      navigate({ to: "/online/$gameId", params: { gameId } })
    },
    //taken or run out between the read and the press: read it again, and
    //the page turns into the one that says so
    onError: () =>
      client.invalidateQueries({
        queryKey: onlineKeys.inviteLink(linkId),
      }),
  })

  let handOffMessage: string | undefined
  if (handOff === "copied") handOffMessage = t("online:link.copied")
  else if (handOff === "failed")
    handOffMessage = t("online:link.copy_failed")

  const askForAccount = () =>
    requireAuth({ redirect: `/invite/${linkId}` })

  //---- which page this is ----------------

  const inviterName = link.data?.inviterName ?? ""
  const state = link.data?.state
  //the public read names the sender and nothing else, and the name is the
  //handle with its casing, so the handle is what it is matched on
  const isOwn =
    user !== null && inviterName.toLowerCase() === user.username
  const isOpen = state === "open"

  //a cached session settles in the first frame; this is only the very first
  //visit on a device, where the buttons would otherwise swap under the thumb
  const isLoading = link.isPending || (isOpen && isAuthPending)
  const loadError = link.isError && !link.data

  const showOpen = isOpen && !isLoading && !isOwn
  const showOwn = isOpen && !isLoading && isOwn
  const showUsed = state === "used"
  const showExpired = state === "expired"
  const showBroken = state === "broken"

  return (
    <Screen className="relative box-border items-center justify-center bg-ground px-safe-offset-6 py-safe-offset-8 text-center">
      <div className="hex-texture hex-texture-inverted pointer-events-none absolute inset-0" />

      <div className="relative flex w-full max-w-[400px] flex-col items-center">
        <Logo aria-hidden="true" className="h-14 w-14" />

        {isLoading && (
          <p role="status" className="mt-6 text-[15px] text-muted">
            {t("online:invite_link.loading")}
          </p>
        )}

        {loadError && (
          <>
            <h1 className={TITLE_CLASS}>
              {t("online:invite_link.load_error_title")}
            </h1>
            <p className={BODY_CLASS}>{translateError(link.error)}</p>
            <div className="mt-8 flex w-full flex-col items-center gap-y-3">
              <Button
                variant="primary"
                size="lg"
                className={ACTION_CLASS}
                onClick={() => link.refetch()}
              >
                {t("online:invite_link.retry")}
              </Button>
              <Link to="/" className={GO_HOME_CLASS}>
                {t("online:invite_link.go_home")}
              </Link>
            </div>
          </>
        )}

        {showOpen && (
          <>
            <h1 className={TITLE_CLASS}>
              {t("online:invite_link.title", {
                name: inviterName,
                brand: BRAND,
              })}
            </h1>

            {!user && (
              <>
                <p className={BODY_CLASS}>
                  {t("online:invite_link.body_signed_out")}
                </p>
                <div className="mt-8 flex w-full flex-col gap-y-3">
                  <Button
                    variant="primary"
                    size="lg"
                    className={ACTION_CLASS}
                    onClick={askForAccount}
                  >
                    {t("common:auth.create_account")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className={ACTION_CLASS}
                    onClick={askForAccount}
                  >
                    {t("common:auth.sign_in")}
                  </Button>
                </div>
              </>
            )}

            {user && (
              <div className="mt-8 flex w-full flex-col">
                <Button
                  variant="primary"
                  size="lg"
                  className={ACTION_CLASS}
                  pending={accept.isPending}
                  onClick={() => accept.mutate(linkId)}
                >
                  {t("online:invite_link.accept")}
                </Button>
                {/* The last thing on the page, so it may rest empty; it
                    holds room for the longest thing it can say, so a
                    refusal that wraps pushes nothing. */}
                <StatusLine
                  role="alert"
                  message={
                    accept.error ? translateError(accept.error) : undefined
                  }
                  messageClassName="text-loss"
                  reserve={ACCEPT_ERRORS.map((key) => t(key))}
                  className="mt-2"
                />
              </div>
            )}
          </>
        )}

        {showOwn && (
          <>
            <h1 className={TITLE_CLASS}>
              {t("online:invite_link.own_title")}
            </h1>
            <p className={BODY_CLASS}>
              {t("online:invite_link.own_body")}
            </p>
            <div className="mt-8 flex w-full flex-col">
              <ShareLinkButton
                url={`${window.location.origin}/invite/${linkId}`}
                text={t("online:link.share_text")}
                onStatusChange={setHandOff}
                statusId={handOffId}
                variant="primary"
                size="lg"
                className={ACTION_CLASS}
              />
              <StatusLine
                id={handOffId}
                role="status"
                message={handOffMessage}
                messageClassName="text-muted"
                reserve={[
                  t("online:link.copied"),
                  t("online:link.copy_failed"),
                ]}
                className="mt-2"
              />
            </div>
          </>
        )}

        {showUsed && (
          <>
            <h1 className={TITLE_CLASS}>
              {t("online:invite_link.used_title")}
            </h1>
            <p className={BODY_CLASS}>
              {t("online:invite_link.used_body", { name: inviterName })}
            </p>
            <SpentLinkActions />
          </>
        )}

        {showBroken && (
          <>
            <h1 className={TITLE_CLASS}>
              {t("online:invite_link.broken_title")}
            </h1>
            <p className={BODY_CLASS}>
              {t("online:invite_link.broken_body")}
            </p>
            <SpentLinkActions />
          </>
        )}

        {showExpired && (
          <>
            <h1 className={TITLE_CLASS}>
              {t("online:invite_link.expired_title")}
            </h1>
            <p className={BODY_CLASS}>
              {t("online:invite_link.expired_body")}
            </p>
            <SpentLinkActions />
          </>
        )}
      </div>
    </Screen>
  )
}

/** A link that cannot be taken: a computer game in one tap, or home. */
function SpentLinkActions() {
  const { t } = useTranslation()

  return (
    <div className="mt-8 flex w-full flex-col items-center gap-y-3">
      {/* the router's own link: nativ's drops `state`, and with it the ask to
          start on the board */}
      <RouterLink {...COMPUTER_GAME} className={PLAY_CLASS}>
        {t("online:invite_link.play_computer")}
      </RouterLink>
      <Link to="/" className={GO_HOME_CLASS}>
        {t("online:invite_link.go_home")}
      </Link>
    </div>
  )
}
