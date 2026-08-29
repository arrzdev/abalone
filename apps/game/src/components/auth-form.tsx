import { cn } from "@repo/nativ/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { FormEvent } from "react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { TextField } from "@/components/ui/text-field"
import type { AuthErrorCode, Credentials } from "@/data/auth/mutations"
import {
  AuthError,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  signIn,
  signUp,
  USERNAME_PATTERN,
} from "@/data/auth/mutations"

type AuthMode = "sign_in" | "sign_up"

/** Which field a failure belongs under. Anything else is about the pair. */
function fieldFor(code: AuthErrorCode): "username" | "password" | "form" {
  switch (code) {
    case "username_taken":
    case "username_invalid":
      return "username"
    case "password_too_short":
      return "password"
    default:
      return "form"
  }
}

export type AuthFormProps = {
  /** Called once the player is signed in, by either route. */
  onAuthenticated?: () => void
  className?: string
}

/**
 * Sign in or create an account: one form, two modes, no email anywhere.
 *
 * The two modes are a segmented control rather than a link under the button.
 * They are the same two fields and the same one press either way, and which one
 * you are on decides what the errors mean — so it belongs at the top, where a
 * choice that changes the rest of the form belongs.
 *
 * It owns its own mutation rather than reporting upwards, so a caller passes
 * nothing but what to do next.
 */
export function AuthForm({ onAuthenticated, className }: AuthFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<AuthMode>("sign_in")
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null)
  const errorId = useId()

  const isSignUp = mode === "sign_up"

  const mutation = useMutation({
    mutationFn: (credentials: Credentials) =>
      isSignUp ? signUp(credentials) : signIn(credentials),
    onSuccess: () => {
      //nothing the last player left behind may be handed to this one — not the
      //profile, not their games, not their invites. clearing rather than
      //invalidating means there is no stale answer to paint from in the
      //meantime, and it covers whatever gets cached next without being edited
      queryClient.clear()
      onAuthenticated?.()
    },
    onError: (error) => {
      setErrorCode(error instanceof AuthError ? error.code : "unknown")
    },
  })

  function switchMode(next: AuthMode) {
    setMode(next)
    setErrorCode(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return

    const fields = new FormData(event.currentTarget)
    const username = String(fields.get("username") ?? "").trim()
    const password = String(fields.get("password") ?? "")

    //the shape rules are checked only when creating an account. on the way back
    //in they would be a guess about a password that already exists, and telling
    //someone their own password is too short is both wrong and unhelpful.
    if (isSignUp) {
      const isWellFormed =
        username.length >= MIN_USERNAME_LENGTH &&
        username.length <= MAX_USERNAME_LENGTH &&
        USERNAME_PATTERN.test(username)
      if (!isWellFormed) return setErrorCode("username_invalid")
      if (password.length < MIN_PASSWORD_LENGTH)
        return setErrorCode("password_too_short")
    }

    if (username.length === 0) return setErrorCode("username_invalid")
    if (password.length === 0) return setErrorCode("invalid_credentials")

    setErrorCode(null)
    mutation.mutate({ username, password })
  }

  const errorField = errorCode ? fieldFor(errorCode) : null
  const errorText = errorCode
    ? t(`common:auth.errors.${errorCode}`)
    : undefined

  const submitLabel = isSignUp
    ? t("common:auth.create_account")
    : t("common:auth.sign_in")

  return (
    //Four blocks, not nine controls: the masthead, the switch, the pair of
    //fields, and the button. 20px between blocks and 18px inside the pair, so
    //the two fields read as one thing you fill in rather than as two more rows
    //in a stack.
    //
    //The form's one error line is the gap between the pair and the button, so
    //the button carries no margin of its own. Measure from the boxes, not from
    //the elements.
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col", className)}
      noValidate
    >
      {/* The heading follows the tab rather than whatever sent you here. Which
          of the two things you are doing is the only thing that changes what
          these fields mean, and a heading that says "sign in" over a form set
          to Create account is the form arguing with itself.

          The mark is a desktop-only flourish. In a drawer the app is still on
          the screen behind the overlay, so a logo inside it is the app's name
          twice; a dialog dims everything it covers, and the mark is what says
          whose dialog this is. */}
      <div className="flex flex-col gap-y-1.5 pb-5 lg:items-center lg:gap-y-3 lg:pb-6">
        <Logo className="hidden size-11 lg:block" />

        <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-white lg:text-center lg:text-3xl lg:font-extrabold lg:tracking-[-0.03em]">
          {isSignUp && t("common:auth.signup_title")}
          {!isSignUp && t("common:auth.prompt_title")}
        </h1>

        <p className="text-sm leading-relaxed text-muted lg:max-w-[380px] lg:text-center lg:text-[15px] lg:text-balance">
          {isSignUp && t("common:auth.signup_body")}
          {!isSignUp && t("common:auth.prompt_body")}
        </p>
      </div>

      <SegmentedControl
        className="mb-5"
        size="lg"
        value={mode}
        onChange={switchMode}
        options={[
          { value: "sign_in", label: t("common:auth.sign_in") },
          { value: "sign_up", label: t("common:auth.create_account") },
        ]}
      />

      <div className="flex flex-col gap-y-[18px]">
        <TextField
          name="username"
          label={t("common:auth.username")}
          placeholder={t("common:auth.username_placeholder")}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={MAX_USERNAME_LENGTH}
          disabled={mutation.isPending}
          invalid={errorField === "username"}
          describedBy={errorCode ? errorId : undefined}
        />

        <TextField
          name="password"
          type="password"
          label={t("common:auth.password")}
          placeholder={t("common:auth.password_placeholder", {
            count: MIN_PASSWORD_LENGTH,
          })}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          disabled={mutation.isPending}
          invalid={errorField === "password"}
          describedBy={errorCode ? errorId : undefined}
        />
      </div>

      {/* One line for the whole form, always in the layout.
          `fieldFor` sorts every failure into exactly one bucket, so at most one
          message exists at a time — a reserved slot under each field as well
          would be two thirds dead air on a form that is doing nothing wrong.
          The offending box turns red; this says what happened.
          Red text and nothing behind it: a tinted panel makes the one thing
          that went wrong the brightest block on the screen. */}
      <p
        id={errorId}
        role="alert"
        className="min-h-10 py-2 text-sm leading-5 text-loss"
      >
        {errorText}
      </p>

      <div className="flex flex-col gap-y-3">
        {/* `lg` because the fields are 56px too: a button taller or shorter
            than the two boxes above it reads as two controls that were drawn on
            different days. */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full rounded-xl"
          disabled={mutation.isPending}
        >
          {submitLabel}
        </Button>

        {/* Kept in the layout in both modes, hidden rather than unmounted. It
            only means anything when creating an account, but a line that
            appears and disappears moves the form under a cursor that is already
            in it — and this column is centred, so half the shift lands above
            the fields as well as below.

            Small print, and drawn like it: it is a fact about the account
            rather than an instruction, and at the weight it used to have it
            competed with the button it sits under. There is no email on the
            account and so nothing to send a reset to, which is the whole of
            what it has to say. */}
        {/* Two lines, and the break is in the string: it is two statements and
            the second is the consequence of the first, so where they divide is
            a translator's call rather than whatever the column width does to
            them. */}
        <p
          aria-hidden={!isSignUp}
          className={cn(
            "text-center text-xs leading-relaxed whitespace-pre-line text-faint",
            !isSignUp && "invisible",
          )}
        >
          {t("common:auth.credentials_warning")}
        </p>
      </div>
    </form>
  )
}
