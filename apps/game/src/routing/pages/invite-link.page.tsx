import { Link, Screen } from "@repo/nativ/components"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Logo } from "@/components/logo"
import { ShareLinkButton } from "@/components/online/share-link-button"
import { Button } from "@/components/ui/button"
import { acceptInviteLinkMutationOptions } from "@/data/online/mutations"
import { inviteLinkQueryOptions, onlineKeys } from "@/data/online/queries"
import { useApiError } from "@/hooks/use-api-error"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"
import { useAuth } from "@/providers/auth-provider"
import { queryClient } from "@/providers/query-client"
import { pageHead } from "@/routing/page-head"
import { BRAND } from "@/utils/brand"

export const Route = createFileRoute("/_subpage/invite/$linkId")({
  //read before the head is written, so the tab, the history entry and a share
  //sheet name who sent it. it never throws: a link that cannot be read still
  //gets a page, and the page says why.
  loader: async ({ params }) => {
    const options = inviteLinkQueryOptions(params.linkId)
    await queryClient.prefetchQuery(options)
    return {
      inviterName:
        queryClient.getQueryData(options.queryKey)?.inviterName ?? null,
    }
  },
  head: ({ loaderData, params }) => {
    const path = `/invite/${params.linkId}`
    const inviterName = loaderData?.inviterName
    if (!inviterName) {
      return pageHead({
        title: "Invite",
        description: `An invite to a game of ${BRAND}, the two-player strategy game of pushing marbles off the board.`,
        path,
        noIndex: true,
      })
    }
    return pageHead({
      title: `${inviterName} invited you to a game of ${BRAND}`,
      description: `Accept and play ${inviterName} online. ${BRAND} is the two-player strategy game where you push six of your opponent's marbles off the board.`,
      path,
      image: "game",
      noIndex: true,
    })
  },
  component: InviteLinkPage,
})

const ACTION_CLASS = "w-full"

//`break-words`: a name is one unbroken word, and twenty characters of it at
//this size is wider than a small phone
const TITLE_CLASS =
  "mt-6 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] break-words text-balance text-white lg:text-[30px]"

const BODY_CLASS =
  "mt-3 text-[15px] leading-relaxed text-balance text-muted"

const GO_HOME_CLASS =
  "clickable inline-flex h-[54px] w-full items-center justify-center rounded-xl bg-brand-fill px-6 font-display text-[17px] font-semibold text-white no-underline transition-colors duration-200 ease-out hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"

/**
 * Where an invite link opens, for whoever opens it.
 *
 * Public on purpose. The person it was sent to usually has no account yet, and
 * a link that answers "sign in first" before saying who sent it is a link
 * nobody follows. So it reads the one thing anybody may know, the sender's name
 * and whether the link still works, and only asks for an account at the moment
 * of saying yes. Signing up from here comes back here, to the same link.
 *
 * A spent link is a dead end with one way out, home. Used and expired read
 * differently because what to do next differs: one was taken by somebody else,
 * the other just ran out.
 */
function InviteLinkPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const translateError = useApiError()
  const { linkId } = Route.useParams()
  const { user, isPending: isAuthPending } = useAuth()
  const { requireAuth } = useAuthPrompt()

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
            <div className="mt-8 flex w-full flex-col gap-y-3">
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
              <>
                <p className={BODY_CLASS}>
                  {t("online:invite_link.body_signed_in")}
                </p>
                <div className="mt-8 flex w-full flex-col">
                  <Button
                    variant="primary"
                    size="lg"
                    className={ACTION_CLASS}
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(linkId)}
                  >
                    {accept.isPending && t("online:invite_link.accepting")}
                    {!accept.isPending && t("online:invite_link.accept")}
                  </Button>
                  <p
                    role="alert"
                    className="mt-2 min-h-5 text-[13px] leading-5 text-loss"
                  >
                    {accept.error && translateError(accept.error)}
                  </p>
                </div>
              </>
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
                variant="primary"
                size="lg"
                className={ACTION_CLASS}
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
            <div className="mt-8 flex w-full flex-col">
              <Link to="/" className={GO_HOME_CLASS}>
                {t("online:invite_link.go_home")}
              </Link>
            </div>
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
            <div className="mt-8 flex w-full flex-col">
              <Link to="/" className={GO_HOME_CLASS}>
                {t("online:invite_link.go_home")}
              </Link>
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
