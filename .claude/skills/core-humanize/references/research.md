# Research grounding and detector reality

Background. None of it is needed during a rewrite; the operational rules are self-contained. Read this when someone asks how detectors work, how far to trust a score, or why a rule exists.

## The finding that reorders everything

**Base models look human.** Raw, non-instruction-tuned base-model output reads as human to state-of-the-art detectors (arXiv 2605.19516, corroborated by Pangram analysis). What current detectors actually fire on is the **RLHF and instruction-tuning layer**: polite hedging, balanced tradeoffs, structured enumeration, perfect local coherence, explainer tone.

That is why the assistant-register layer sits above vocabulary in this skill's priority order. Scrubbing "delve" attacks a 2023 model of the problem.

## Stylometric grounding

- Wu et al. 2025, Kujur 2025, Mitchell et al. 2023 (DetectGPT), and the AAAI 2025 shared task corpus ground the eight stylometric signals: perplexity, burstiness, hedge density, lexical repetition, structural markers, specificity, POS density, punctuation fingerprint.
- **DetectGPT / Fast-DetectGPT**: AI text sits at a local maximum of model probability. Human edits and genuine idiosyncrasy move it off that maximum.
- **DivEye** (arXiv 2509.18880, TMLR 2026): AI text shows lower variability in token-level surprisal. It reads too uniform, and the signal survives surface rewriting. This is the basis for the local-coherence-over-smooth check.
- Structural regularity outweighs vocabulary in trained classifiers. Pangram trains on roughly 28M human documents and weights consistent sentence construction, uniform pacing and symmetrical phrasing above word choice.

## Advanced techniques, when stakes justify the cost

Hybrid approaches (rules plus a model in the loop) benchmark better than pure rules.

| Technique | Source | Result |
|---|---|---|
| Detector-scored best-of-N: generate 3 to 5 variants, score each, ship the lowest | arXiv 2506.07001 | 87.88% average true-positive-rate reduction across 8 detectors |
| Iterative paraphrase, second model, "keep the meaning" | PADBen, arXiv 2511.00416 | Creates a laundering region that defeats most surface detectors; diminishing returns past 2 passes, and meaning drifts |
| Writer-profile distillation: extract style hypotheses from samples first | HyPerAlign, arXiv 2505.00038 | Beats raw few-shot voice matching |
| Self-rewrite distance check: ask another model to "rewrite this in different words" | Raidar, arXiv 2401.12970 | Near-identical rewrite means the text sits at a local probability maximum, so it reads as AI |
| Embedding-guided synonym swap chosen to lower detector scores | arXiv 2501.18998 | Beats static word lists |
| Disfluency injection, casual register only | arXiv 2412.12710 | Raises perceived spontaneity; in a board memo it is its own tell |
| Decoding control at generation time: temperature 0.9-1.1, top-p 0.95-0.99, repetition penalty 1.1-1.2 | RAID, arXiv 2405.07940 | More destructive to detectors than paraphrase attacks |

## Documented dead ends

- **Homoglyph and zero-width injection** (SilverSpeak, arXiv 2406.11239): drops detector MCC to near zero, defeated by Unicode normalization, and is an unambiguous tampering signal. The scanner flags these characters as residue to remove, not a technique to use.
- **Single cross-model rewrite** (DAMAGE, arXiv 2501.03437): model A rewriting model B's output does not defeat trained detectors on its own.
- **Watermark stripping**: a separate problem space (RLCracker arXiv 2509.20924, De-mark arXiv 2410.13808).

## Detector landscape

- **GPTZero (2025)**: RL adversarial self-training plus a learned classifier ensemble, four-class output. The old "perplexity plus burstiness" description is stale.
- **Binoculars**: strong zero-shot baseline, but roughly 55% AUROC on Claude-generated text versus about 88% on GPT-3.5 (DetectRL, arXiv 2410.23746).
- **Pangram 3.0**: vendor-claimed 99.98% accuracy at 1-in-10,000 false-positive rate, 97% on humanized text. Independent replication pending.
- **EditLens** (arXiv 2510.03154): estimates the AI-edited fraction rather than binary authorship. Useful framing, since the common real case is a human editing an AI draft or the reverse.
- **Ghostbuster**: canonical black-box detector, 99 F1 in domain, degrades out of domain.

## Ceilings: when to cap confidence

- Text plausibly from a base model or a minimally fine-tuned paraphraser: cap at medium even when surface signals look clean.
- Text plausibly from Claude, given the Binoculars blind spot: treat low scores with caution.
- Text the user says was paraphrased or rewritten: down-weight everything (PADBen).
- Non-English text: detectors misclassify badly. One commercial detector fell from 92% to 12% accuracy on lightly-polished human Arabic (arXiv 2511.16690). Refuse high confidence without language-matched calibration.
- Stylistic cues are corpus-conditional (SHAP analysis, arXiv 2603.23146). Do not over-anchor on any single signal; require corroboration across categories.

## The false-positive problem, stated plainly

- Commercial detectors show false-positive rates above 60% on non-native English writers (Liang et al., Stanford, *Patterns* 2023).
- Open-source detectors show overall misclassification above 70% in at least one audit (Jabarian & Imas, BFI Working Paper 2025-116).
- Adversarial paraphrase reduces detection accuracy by about 88% across every method tested (arXiv 2506.07001).

Which is why this skill scores writing, not people. A score is a reason to edit a draft. It is never evidence for an academic-integrity case, a hiring decision, or a public accusation. If someone asks for that, say what the numbers can and cannot support.

## Sources merged

- `harshaneel/humanize` (MIT): the nine levers, the counted pre-output gate, the rhetorical-scaffolding checklist, the nine-signal scoring rubric, the research grounding above.
- `conorbronsdon/avoid-ai-writing` (MIT): the tiered vocabulary model, the context and voice profiles, the tolerance matrix, the carve-outs, the detector-versus-judgment category split, the false-positive ethics.
- `blader/humanizer` (MIT): the Wikipedia "Signs of AI writing" content patterns, the never-invent-facts rule, "personality and soul", the signs-of-human-writing list, the invocation modes.
