---
name: core-copywriting
description: Rules for every user-visible string: no connective dashes, say what happened then what to do next, drop jargon, keep it short and cut helper text that does not earn its place. Use when writing error messages, labels, buttons, toasts, empty states, placeholders, or any UI copy.
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

## Length and helper text

### When a helper text earns its place
Keep it only if ALL are true:
1. The label, title and control do not already say it.
2. The user cannot guess it, or guessing wrong costs something (lost move, failed upload, wasted invite).
3. It is relevant to most users at this moment (not a rare edge case; rare cases belong in the error).

Test: delete the line. Would a user get stuck, make a mistake, or be surprised? No: it stays deleted.

Always delete:
- A line that repeats the title, the label or the button ("Accept and play" + "Accept and the game starts").
- A line that states what the control visibly does ("A coordinate in every cell").
- A permanent constraint the user cannot act on ("It can't be changed").
- Reassurance and filler ("Game started!", "Nothing here yet" + a second line saying the same).

### Max length per element
| Element | Max | Notes |
|---|---|---|
| Button, tab, menu item | 3 words | A verb for the action: "Send invite", not "Invite". |
| Field label | 3 words | Noun. Placeholder never repeats the label. |
| Hint under a field or toggle | 1 sentence, 8 words, no full stop | Most toggles need none. |
| Drawer / dialog title | 5 words | |
| Drawer / dialog body | 1 sentence, 12 words | Two sentences only for destructive actions. |
| Empty state | Title 4 words + 1 line of 10 words + the action | |
| Toast / status | 5 words | Say the result, not the process. |
| Error | What happened, then what to do; 14 words total | |

### Labels say the action
- Buttons name what happens next ("Send invite", "Accept and play"), never "OK", "Submit", "Yes".
- A cancel/dismiss button names the thing it keeps or drops only when ambiguous ("Keep playing").
- Titles name the thing; the button does the verb. Do not repeat both.

## Where this lands in the codebase

- The API error registry (`ERROR_CODES` in `core-custom-errors`) holds most user-facing strings — they render to users through the app's `ok()` / `error()` envelope (`createApiEnvelope(ERROR_CODES)`). Edit copy there once and every response uses it.
- Any JSX or string literal shown in the UI follows the same rules.
