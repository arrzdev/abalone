# Layout checks for dialogs and status text

Three rules hold for every dialog, sheet and line of status text in the game,
and each has an e2e helper in `e2e/support/layout.ts` that any spec can call.
`e2e/modal-layout.spec.ts` runs them on every dialog at 375x667, 402x710 and
1280x800, in Chromium and WebKit.

## 1. Nothing moves when you press something

`expectNoLayoutShift(scope, action, { until })` records the layout box of
`scope` and of everything in it, runs `action`, and fails if any of those boxes
moved or changed size in any frame until `until` resolves and the region is at
rest. Transforms (press scale, a sheet's slide) and scrolling do not count.

How to keep it:

- Text that arrives after a press (a confirmation, an error, "Making a link")
  goes into a line that is already in the layout and already tall enough for
  the longest thing it can say. Stack the possible messages in one grid cell,
  the hidden ones `invisible`, as `Reserved` in `auth-form.tsx` does, so the
  line is sized by the longest message in the current language and at the
  current width. A `min-h` of one line is not enough: a message that wraps
  grows it.
- A reserved line is never an empty block in the middle of a dialog (rule 3
  counts it as a gap). Give it resting text that the message replaces (a hint
  under a field, a line under a button), or put it where empty space is not
  between two blocks.
- A control that is replaced by another (a "make a link" button by the link
  and its copy button) is replaced by something of the same height.
- Suggestions and lists that open from a field open over the content
  (a popover), not in a block reserved under the field.

## 2. No text is cut off

`expectNoClippedText(scope)` fails when a box with text is wider than its room
without an ellipsis, or when a line of text or a field reaches outside a box
that clips it (the dialog, its scroller, the screen). A dialog that has more
than fits is the bug, not the scroller.

How to keep it:

- A value that may be longer than its field (an invite URL) ends in an
  ellipsis (`text-ellipsis`); the full value stays the field's value, so it
  can still be selected and copied.
- A dialog fits the smallest supported screen (375x667) without scrolling.

## 3. One vertical rhythm

`expectEvenRhythm(scope, { sizes: [8, 20] })` splits the region into bands of
content (text, controls, pictures, filled boxes) and fails when the gaps
between them take more than two sizes, or sizes other than the tokens:

| Gap | Size | Where |
|---|---|---|
| tight | 8px (`2`) | label to control, title to the line under it, control to its hint |
| section | 20px (`5`) | between sections, header to first section, last section to the primary action |

An empty block of reserved space shows up as a third, larger gap. Use the
spacing scale (`gap-y-5`, `mb-2`), not one-off margins, and let the container's
`gap` set the section spacing rather than a margin on each child.
