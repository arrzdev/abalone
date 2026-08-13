---
name: core-copywriting
description: Rules for every user-visible string: no connective dashes, say what happened then what to do next, drop jargon. Use when writing error messages, labels, buttons, toasts, empty states, placeholders, or any UI copy.
---

# Copywriting (user-facing text)

Applies to every string a user can read: error messages, labels, buttons, toasts, empty states, placeholders, microcopy. Not for code comments, log lines, commit messages, or identifiers.

## No dashes inside a sentence

**Never use `-`, `–`, or `—` as punctuation between clauses.** Rewrite with a comma, a period (two short sentences), or a rephrase. Connective dashes read as terse and technical and hurt the tone.

| ❌ Don't | ✅ Do |
|---------|-------|
| Verifying you're human — one moment, then try again. | Still confirming that you're human. Please wait a moment, then try again. |
| Payment failed - check your card. | Payment failed. Check your card details and try again. |
| Saved — your changes are live. | Saved. Your changes are live. |

This bans the **connective dash**, not hyphenated words: `sign-in`, `two-factor`, `read-only` keep their hyphen where that is the correct spelling. Test: if you could swap the `-` for "to", "and", or a pause, it is a break — remove it and restructure.

## Make error copy human

- Say **what happened**, then **what to do next**, in that order.
- Drop jargon the user never typed: "security check" not "captcha", "sign in" not "auth", "session expired" not "invalid token".
- One idea per sentence. Two short sentences beat one clause-chained line.
- No blame, no shouting, no leading `Error:`. State it plainly and give the next step.

| ❌ | ✅ |
|----|----|
| Captcha verification failed. | We couldn't confirm that you're human. Please try again. |
| Invalid auth token - please re-login. | Your session expired. Please sign in again. |

## Where this lands in the codebase

- The API error registry (`ERROR_CODES` in `core-custom-errors`) holds most user-facing strings — they render to users through the app's `ok()` / `error()` envelope (`createApiEnvelope(ERROR_CODES)`). Edit copy there once and every response uses it.
- Any JSX or string literal shown in the UI follows the same rules.
