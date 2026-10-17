## What and why

## How to verify

<!-- UI changes only (any .tsx or CSS that renders): tick each line or say why it does not apply. Rules: .claude/skills/core-ui-quality-gate -->
## UI quality gate

- [ ] No layout shift: click, open, hover, focus, loading → loaded, font swap
- [ ] Space reserved for text that appears later (status, error, feedback)
- [ ] No hard-clipped text: ellipsis or wrap, never cut mid-character
- [ ] No text hidden by its container, the viewport, or a sticky bar
- [ ] Modals and dialogs fit without scrolling at 375x667
- [ ] Focus ring fully visible on every control (not cut by overflow)
- [ ] Touch targets ≥ 44x44 on phone
- [ ] Empty, loading and error states exist and look designed
- [ ] Checked at 375x667, 402x710 and desktop, Chromium + WebKit
- [ ] New UI spec uses the shift and clipped-text helpers
