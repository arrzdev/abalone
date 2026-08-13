---
name: core-humanize
description: Strip AI-writing tells from text and rebuild it so it reads like a person wrote it, or score a draft forensically for how AI it reads. Use this whenever the user says humanize, "make this sound human", "less AI", "remove AI-isms", "does this sound AI?", "why does this read like ChatGPT", or pastes text asking why it feels generic, robotic, or flat. Also use it before publishing anything you drafted (posts, emails, docs, READMEs, PR descriptions, landing copy) where sounding machine-written would cost credibility, and when writing new prose in those registers from scratch.
---

# Humanize

Two jobs, same body of knowledge: rewrite text so it reads as human, or diagnose why it doesn't.

Scope is prose a reader sees. In-product strings (errors, labels, toasts, empty states) are governed by `core-copywriting`, whose no-connective-dash rule this skill enforces mechanically. Marketing structure and conversion argument are a different question again.

The hard part isn't knowing the patterns. It's that **the model that wrote the draft is the model auditing the draft**, and from memory it always reports clean. You do not remember writing an em dash. Your rhythm always sounds varied to you. So every mechanical claim here gets counted by a script, not recalled, and the judgment calls get a written checklist instead of a vibe check.

```bash
python3 scripts/aitells.py draft.md              # counts, nine-signal score, verdict
python3 scripts/aitells.py - --register casual   # stdin; relax register-scoped rules
python3 scripts/aitells.py draft.md --json       # machine-readable
```

Paths are relative to this skill's directory. Run the scanner on the input **and again on your rewrite**: regenerated prose reintroduces tells at roughly the first-draft rate, which is the most common way a humanization pass silently fails.

## Before anything: what this is not

These patterns are statistically more common in LLM output. They are not proof. Commercial detectors show false-positive rates above 60% on non-native English writers, and adversarial paraphrase drops detection accuracy by about 88% across every method tested (see `references/research.md`). Real people writing fast, in a second language, or in a genre they don't know produce the same shapes.

Use this to make writing better and to assess your own drafts. Never hand someone a score as a verdict about whether they cheated. If asked to, say what the signals are and what they aren't.

## Modes

| Mode | Trigger | You deliver |
|---|---|---|
| **rewrite** (default) | pasted text, "humanize this" | the rewritten text, then a short audit of what you changed |
| **check** | "does this sound AI?", "score this", "what gives it away" | the forensic report, no rewrite |
| **edit** | "clean up `draft.md`", a file path | minimal targeted edits in place, then a summary, not the whole file |
| **embedded** | another task uses this as a step (a PR body, a commit message, marketing copy) | the finished prose only, no audit, no preamble, no changelog |

In embedded mode especially: the caller wants prose, not ceremony. No "Here's the humanized version", no "Main moves:" list.

## The loop

**0. A voice sample beats every rule below.** If the user supplied their own writing, read it first and extract 5 to 10 concrete hypotheses: sentence-length range, vocabulary level, how paragraphs open, punctuation habits, verbal tics, transition style. Then write to those. If they write "stuff" and "things", do not upgrade them. Matching the author beats scrubbing the tell, every time. Removing AI patterns without replacing them with the sample's patterns produces text that is clean and still not theirs. The one exception is the dash rule below.

**1. Read the whole input. Name the register** (blog, technical, docs, Slack, email, social, creative, encyclopedic). Register decides which rules relax; see `references/registers.md`. Say which one you picked if it isn't obvious.

**2. Run the scanner.** Take the numbers as your starting evidence, not as the whole audit. The report ends with a list of what it could not check.

**3. Rewrite in one pass, from the content, not from the phrasing.** Extract what the text says, then re-derive the prose. Do not walk through it swapping words. This matters most when the input is text *you* wrote earlier in the conversation: anchoring to your own phrasing degrades the rewrite into substitutions that leave the rhythm, the pivots and the punctuation intact. If your list of changes reads as a table of word swaps, you light-edited. Start over.

**4. Re-run the scanner on the rewrite.** Fix what survived. Fix what you introduced.

**5. Run the judgment audit** below on the rewrite. The script cannot see any of it.

**6. Loop once, then stop.** Empirically the first revision leaves two to four scaffolding patterns and one loop clears them. Past the second pass you over-edit into choppy, voiceless prose, which is its own tell.

**7. Ship the shape the mode calls for.**

## Judgment audit

Run this against the rewrite, paragraph by paragraph, and quote each hit before fixing it. These survive the scanner because they feel like good writing, which is exactly why they are the hardest tells: the model learned them from skilled human writers and applies them too evenly.

- [ ] **Mini-aphorism closer.** Paragraph ends on a punchy 4-to-10-word lesson ("That's the part that stuck."). Cut it or fold it into the sentence before.
- [ ] **Aphoristic final line.** The last sentence reads as quotable standalone wisdom. End on a specific detail, an open question, or the next action.
- [ ] **Thesis-first opener.** The frame arrives before the experience ("The rollout was the hard part."). Start with the concrete thing and let the thesis emerge.
- [ ] **Chiasmus and balanced opposition.** "Being specific about being wrong beats being vague about being right." Real insight is asymmetric; symmetry is constructed.
- [ ] **Tricolon.** Three parallel beats with identical grammar, often escalating. Break the third out, join two with "and", or cut to two.
- [ ] **Anaphora.** Two or more consecutive sentences opening the same way. Vary one.
- [ ] **Parallel reason chains.** Three "subject + because + reason" sentences in a row. Vary the clause shape.
- [ ] **Parallel-subject mirror.** "The code is one thing. Maintaining it is another."
- [ ] **Pattern announcement.** Naming a pattern before describing it. Just describe it.
- [ ] **Self-labeling significance.** Pointing back at your own list to flag which item matters ("that last one is the contrarian bit"). If it needs the label, it isn't.
- [ ] **Synonym cycling.** One referent, three labels (the company, the firm, the organization). Pick the canonical noun and vary with a pronoun.
- [ ] **Local coherence over-smooth.** Every sentence connects perfectly, nothing misfires, every paragraph closes cleanly. Let one sentence shift direction or land rougher than its neighbours.
- [ ] **Paragraph-reshuffle test.** Can two body paragraphs swap without damage? Then you wrote a list of points, not an argument. Give the piece a through-line.
- [ ] **Treadmill test.** For each paragraph: what fact, claim, or turn is new here? If nothing, cut it. If something, lead with it.
- [ ] **Invented facts.** Nothing in the rewrite may state a fact, name, number, date, or citation absent from the source. Specificity is the strongest human signal, and fabricating it is the one unforgivable move. Where the source has no anchors, use plausible-specificity framing ("in the cases I've seen", "when you're running at that scale") and flag the gap to the user instead of inventing detail. In fiction, invented detail is the job; this governs everything else.

**Flagged residuals get removed, not justified.** "Removing it would collapse the paragraph", "this register needs it", "it reads thin without it" is how these survive. If cutting a flagged sentence makes a paragraph thin, the paragraph was thin. An honest 80 words beats a padded 200 that reads as machine output. When your own audit says "borderline, but I'm keeping it because…", cut it.

## The dash rule (absolute)

**No dash is ever used as punctuation between clauses.** Not the em dash, not the en dash, not the double hyphen, not the spaced hyphen. Every register, every genre, including list items, headings, chat messages and creative prose. If the user's own writing sample is full of them, you still do not write them.

Replace with a period (usually), a comma (a tight aside), a colon (introducing an explanation), parentheses (a true aside), or restructure the sentence.

> The new policy — announced without warning — affects thousands of workers. The build is green - finally.

> The new policy, announced without warning, affects thousands of workers. The build is finally green.

This bans the connective dash, not the hyphen in a compound word: `sign-in`, `two-factor`, `high-quality`, `end-to-end` keep theirs. Test: if you could swap the mark for "to", "and", or a pause, it is a clause break, so restructure. The scanner counts all four forms and skips hyphenated words, list bullets and numeric ranges. Same rule as `core-copywriting`, enforced mechanically.

## What the tells actually are, in priority order

Full catalog with before/after examples: `references/patterns.md`. The ordering matters more than the list, because it is where the three source skills disagreed and where most rewrites spend effort in the wrong place.

**Layer 0. Mechanical, and free to fix.** Dashes (above), semicolons, curly quotes, emoji, bold spam, Title Case headings, hashtag blocks, unfilled `[placeholders]`, chat citation markup, `utm_source=chatgpt.com`. The scanner counts all of these. Leaked markup and tracking parameters are fingerprints rather than style: their presence is close to proof, and the fix is deletion.

**Layer 1. Structure and rhythm. This is the number one detection signal.** Classifiers trained on tens of millions of documents weight structural regularity above vocabulary. Fix every flagged word, leave the rhythm metronomic, and the text still reads as AI. Targets, all countable: sentence-length spread of 20+ words, fewer than half the sentences in the 10-to-20-word band, no three consecutive mid-length sentences within 5 words of each other, at least one fragment per 150 words, paragraphs of visibly different sizes.

**Layer 2. The assistant register. This is what current detectors actually fire on.** Base-model output reads as human to state-of-the-art detectors; what gets flagged is the RLHF layer, the helpful-assistant voice. Strip it: the "let me walk you through" framing, balanced tradeoffs where you should pick a side, unrequested enumerated options, pedagogical recaps of what the reader already knows, caveats appended to every claim, sycophantic prefixes, closing summaries, "I hope this helps". Highest value per unit of effort.

**Layer 3. Rhetorical scaffolding.** The judgment audit above. Hardest to see, survives paraphrase.

**Layer 4. Content patterns.** Significance inflation, promotional brochure register, participial pseudo-analysis ("symbolizing the region's commitment to progress"), vague attribution ("experts believe"), copula avoidance ("serves as" for "is"), false ranges, rule of three, negative parallelism ("it's not X, it's Y"), speculative gap-filling, generic upbeat closers. Mostly vocabulary-adjacent, mostly easy, and the layer people over-index on.

## The other failure mode

A rewrite that clears every flag and reads sterile is still machine output. Removal is half the job.

Where the genre carries a voice (essays, posts, opinion, personal writing), put voice back deliberately: a stated preference, a reaction, an aside, one thought left unresolved, uneven rhythm. Never manufacture it with facts you invented. Stance and reaction are voice; claims are not.

Where the genre is encyclopedic, technical, legal, or reference, neutral and plain **is** the human voice. Do not inject first person or opinions there. That mistake reads worse than the AI-isms did.

When you are editing a **human's** text, preserve their typos, contractions, odd capitalization and idiosyncratic word choices. Smoothing those away erases the fingerprint that marked it as theirs, and pushes human writing toward the AI profile. Over-polishing is a way to fail this task.

### What not to flag

Perfect grammar. Formal vocabulary that isn't on the lists. A single "however". Curly quotes alone (every editor auto-curls). One em dash in someone else's prose (many editors and journalists use them; the zero-dash rule governs what *you* write, not what proves *they* used a model). One short emphatic sentence. Unsourced claims. Mixed casual and formal register, which usually means a technical writer or a second-language writer, not a bot. Text inside quotation marks, code blocks, or examples being discussed rather than used.

Look for **clusters**. A single em dash means nothing. Em dashes plus rule of three plus "vibrant tapestry" plus a Conclusion section is a confession.

Signs of a real person, which you protect rather than edit: hard-to-fabricate specific detail, mixed feelings and unresolved tension, era-bound slang and in-jokes, genuine self-interruption, real variety in sentence length.

## Where the sources disagreed, and what to do

This skill merges three public skills that conflict on four points. Resolutions:

| Question | Resolution |
|---|---|
| Em dashes: zero, or one per 300 words? | **Zero, everywhere, no exceptions.** No rate allowance (you will spend it), no list-item carve-out, no register relaxation, and a writing sample does not override this one. |
| Curly quotes: near-certain tell, or noise? | **Register-scoped.** Strong in plaintext, commit messages, code comments, where nothing auto-curls. Weak to worthless in anything that passed through Word, Docs, macOS, or a CMS. Never conclusive alone. |
| Show a changelog of edits, or output text only? | **Mode decides.** rewrite: text first, then a short audit. check: report only. edit: summary only. embedded: prose only. A long list of word swaps is also evidence you light-edited. |
| How many passes? | **Two, hard cap.** Draft plus one corrective pass. A third costs a full regeneration and finds almost nothing, while sanding out the irregularity that made it read human. |

## Writing new text this way

Same rules from the first sentence, plus:

- Skip the throat-clearing opener. No "In this post I will". Start mid-thought or on the concrete thing.
- End when the thought ends. No summary paragraph unless the piece is long enough to need a re-anchor.
- Every paragraph earns one anchor: a number, a name, a date, an example.
- Calibrate to domain. An engineer's Slack post and a board memo are different languages; see `references/registers.md`.
- When you control decoding: temperature 0.9 to 1.1, top-p 0.95 to 0.99, repetition penalty 1.1 to 1.2. Widening the token distribution breaks the local-probability-maximum property that perplexity detectors rely on.

## What this does not do

It does not guarantee a clean score on any commercial detector; nothing does reliably. It does not add facts to manufacture specificity. It does not change what the text claims, only how it reads. It does not apply one transformation to every register.

## Files

| File | Read it when |
|---|---|
| `scripts/aitells.py` | every run, on the input and on the rewrite |
| `references/patterns.md` | you need the full catalog, the before/after examples, or the exact fix for a named pattern |
| `references/registers.md` | picking or defending a register, matching a voice, or deciding which rules relax |
| `references/research.md` | someone asks how detectors work, what they miss, or how far to trust a score |
