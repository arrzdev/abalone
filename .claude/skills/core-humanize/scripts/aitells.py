#!/usr/bin/env python3
"""Scan text for mechanical AI-writing tells and print a signal report.

    python3 aitells.py draft.md
    cat draft.md | python3 aitells.py -
    python3 aitells.py draft.md --json
    python3 aitells.py draft.md --register casual    # relax register-scoped rules

Why this exists: the model that wrote a draft cannot audit that draft from
memory. Asked to "count the em dashes", it reports zero and moves on. Every
number here is counted from the actual bytes, so the audit stops depending on
recollection. What the script CANNOT judge (whether a specific is true, whether
the voice matches, whether a flagged phrase is the right call in context) it
says so rather than guessing.

Scoring follows the nine-signal rubric (A-I, 0-3 each, 27 max). Signals the
regex layer cannot see are listed at the end of the report for a human pass.

Exit code is 0 unless --strict, which exits 1 when any HARD tell survives.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import unicodedata

# ---------------------------------------------------------------- vocabulary

# tier 1: 5-20x more common in AI text; replace on sight
TIER1 = [
    r"delv(?:e|es|ed|ing)", r"leverag(?:e|es|ed|ing)", r"utiliz(?:e|es|ed|ing)",
    r"robust(?:ness)?", r"comprehensive(?:ly)?", r"streamlin(?:e|es|ed|ing)",
    r"pivotal", r"meticulous(?:ly)?", r"seamless(?:ly)?", r"tapestry",
    r"testament to", r"realm", r"paradigm(?:-shifting)?", r"embark(?:s|ed|ing)?",
    r"beacon", r"cutting-edge", r"underscor(?:e|es|ed|ing)", r"nestled",
    r"vibrant", r"thriving", r"bustling", r"showcas(?:e|es|ed|ing)",
    r"intricac(?:y|ies)", r"intricate", r"ever-evolving", r"enduring",
    r"daunting", r"holistic(?:ally)?", r"actionable", r"impactful",
    r"learnings", r"thought leader(?:ship)?", r"best practices", r"at its core",
    r"synerg(?:y|ies)", r"interplay", r"in order to", r"due to the fact that",
    r"serves? as", r"boasts?", r"commence(?:s|d)?", r"ascertain",
    r"endeavor", r"game-chang(?:er|ing)", r"watershed moment",
    r"deep dive", r"div(?:e|es|ing) into", r"unpack(?:s|ed|ing)?",
    r"the future looks bright", r"only time will tell", r"myriad",
    r"plethora", r"in the realm of", r"the landscape of",
]

# tier 2: fine alone, a tell when 2+ land in one paragraph
TIER2 = [
    r"harness(?:es|ed|ing)?", r"navigat(?:e|es|ed|ing)", r"foster(?:s|ed|ing)?",
    r"elevat(?:e|es|ed|ing)", r"unleash(?:es|ed|ing)?", r"empower(?:s|ed|ing)?",
    r"bolster(?:s|ed|ing)?", r"spearhead(?:s|ed|ing)?", r"resonat(?:e|es|ed|ing)",
    r"revolutioniz(?:e|es|ed|ing)", r"facilitat(?:e|es|ed|ing)", r"underpin(?:s|ned|ning)?",
    r"nuanced", r"crucial(?:ly)?", r"multifaceted", r"ecosystem",
    r"encompass(?:es|ed|ing)?", r"catalyz(?:e|es|ed|ing)", r"reimagin(?:e|es|ed|ing)",
    r"galvaniz(?:e|es|ed|ing)", r"augment(?:s|ed|ing)?", r"cultivat(?:e|es|ed|ing)",
    r"illuminat(?:e|es|ed|ing)", r"elucidat(?:e|es|ed|ing)", r"juxtapos(?:e|es|ed|ing)",
    r"transformative", r"cornerstone", r"paramount", r"poised to",
    r"burgeoning", r"nascent", r"quintessential", r"overarching",
    r"garner(?:s|ed|ing)?", r"align(?:s|ed)? with",
]

# tier 3: ordinary words AI over-serves; only density matters
TIER3 = [
    r"significant(?:ly)?", r"innovat(?:ive|ion)", r"effective(?:ly)?",
    r"dynamic(?:s)?", r"scalab(?:le|ility)", r"compelling", r"unprecedented",
    r"exceptional(?:ly)?", r"remarkabl(?:e|y)", r"sophisticated",
    r"instrumental", r"world-class", r"state-of-the-art", r"best-in-class",
    r"valuable", r"key (?=factor|role|insight|takeaway|challenge)",
]

HEDGES = [
    r"it (?:is|'s) (?:important|worth) (?:to note|noting|mentioning)",
    r"it is worth noting", r"generally speaking", r"in many cases",
    r"it can be argued", r"one might (?:consider|argue)", r"perhaps",
    r"arguably", r"relatively speaking", r"to be clear", r"to be honest",
    r"quite frankly", r"results may vary", r"tends? to", r"typically",
    r"generally", r"often(?=,| )", r"could potentially", r"may eventually",
    r"might ultimately", r"can sometimes",
]

TRANSITIONS = [
    r"furthermore", r"moreover", r"additionally", r"it is clear that",
    r"this (?:highlights|underscores|demonstrates) the importance",
    r"as (?:previously|mentioned) (?:mentioned|above)", r"in addition to the above",
    r"it goes without saying", r"needless to say", r"in conclusion",
    r"in summary", r"to summarize", r"at the end of the day",
    r"when it comes to", r"that (?:said|being said)", r"turns? out",
    r"in today'?s", r"in an era where",
]

CHATBOT = [
    r"i hope this helps", r"let me know if", r"feel free to reach out",
    r"great question", r"excellent point", r"you'?re absolutely right",
    r"certainly!", r"of course!", r"absolutely!",
    r"as of my (?:last|training)", r"up to my last training",
    r"i don'?t have access to real-?time",
    r"while specific details are (?:limited|scarce)",
    r"in this (?:article|post|section),? (?:we|i) will",
    r"let'?s (?:dive|explore|break|take a look|examine|unpack)",
    r"here'?s what you need to know", r"without further ado",
    r"let me (?:walk you through|think step by step)",
    r"breaking this down", r"here'?s my thought process",
]

SCAFFOLD = [
    # negation pivots and diminishment
    (r"(?:it'?s|this is|that'?s|they'?re) not (?:just |merely |only )?[^.!?,;]{2,40}[,;] (?:it'?s|this is|but)", "negation pivot"),
    (r"\bnot just\b", "not-just diminishment"),
    (r"\bnot (?:a|an|the) [^.!?,]{2,30}, (?:a|an|the|it'?s)\b", "not-X-but-Y"),
    (r"\bisn'?t (?:about|proof|the) [^.!?]{2,40}\.\s+(?:it'?s|the real)", "split negation"),
    # comparative and binary framing
    (r"\bmore [a-z]+ than [a-z]+\b", "more-X-than-Y framing"),
    (r"\bwhether you'?re (?:a |an )?[^,]{2,30}, ", "false-breadth whether"),
    (r"\beither [^.!?]{2,30} or [^.!?]{2,30}\b", "either/or binary"),
    # announcement and reveal
    (r"^(?:the (?:rule|key insight|approach|pattern|real question|thing)) [^.!?\n]{0,40}:", "announcement colon"),
    (r"\bwhat (?:i (?:didn'?t expect|realized|learned)|surprised me|changed everything|finally clicked|made the difference) was\b", "setup sentence"),
    (r"\bthe (?:catch|kicker|best part|result|twist)\?", "infomercial hook"),
    (r"^(?:honestly|look|real talk|here'?s the thing)[,.?:]", "fake-candid opener"),
    # inflation and profundity
    (r"\b(?:stands? as a testament|marks? a pivotal moment|indelible mark|evolving landscape|setting the stage for|a key turning point)\b", "significance inflation"),
    (r"\b(?:is|are|becomes?) the (?:language|currency|architecture|backbone|lifeblood) of\b", "aphorism formula"),
    (r"\b(?:real|actual|genuine|true) (?:utility|value|accuracy|sustainability|product-market fit|innovation)\b", "real/actual inflation"),
    (r"\b(?:experts?|researchers?|analysts?|industry (?:observers|leaders)|studies|critics) (?:believe|argue|say|show|suggest|agree|have noted)\b", "vague attribution"),
    (r"\b(?:independent|third-party) (?:testing|benchmarks?) (?:confirms?|shows?)\b", "unnamed validation"),
    # participial pseudo-analysis
    (r", (?:highlighting|underscoring|emphasizing|reflecting|symbolizing|showcasing|ensuring|contributing to|cultivating|fostering|encompassing) [a-z]", "-ing pseudo-analysis"),
    # copula avoidance
    (r"\b(?:serves? as|stands? as|represents?|features?|boasts?|offers?) (?:a|an|the) \b", "copula avoidance"),
    # scenario openers
    (r"\b(?:imagine|picture|envision) a (?:world|future|scenario) (?:where|in which)\b", "speculative opener"),
    # closers
    (r"\b(?:may|could|will|is poised to) become one of the most\b", "future-narrative closer"),
    (r"\b(?:worth (?:your time|a read|reading)|must-read|don'?t sleep on this|thank me later|bookmark this)\b", "endorsement closer"),
    (r"\bdespite (?:these |the )?challenges?[^.!?]{0,40}(?:continues? to|remains?)\b", "formulaic challenge"),
    # attention claims
    (r"\b(?:i keep coming back to|i can'?t stop thinking about|still thinking about this)\b", "lingering-attention claim"),
    (r"\bwhat (?:surprised|struck|fascinated) me (?:most|was)\b", "emotional flatline"),
]

FILLER = [
    (r"\bin order to\b", "to"), (r"\bdue to the fact that\b", "because"),
    (r"\bat this point in time\b", "now"), (r"\bin the event that\b", "if"),
    (r"\bhas the ability to\b", "can"), (r"\bfor the purpose of\b", "to"),
    (r"\bwith regard to\b", "about"), (r"\bprior to\b", "before"),
    (r"\bsubsequent to\b", "after"), (r"\bdespite the fact that\b", "although"),
    (r"\bin terms of\b", "(rewrite)"), (r"\bthe reality is that\b", "(cut)"),
]

LEAKS = [
    (r"utm_source=(?:chatgpt\.com|openai|claude\.ai|perplexity\.ai|copilot\.com)", "AI tracking parameter"),
    (r"citeturn\d+\w*|contentReference\[oaicite:|oai_citation|grok_card", "chat citation markup"),
    (r"\[(?:Your|Insert|Add|Enter|Describe|Specify|Choose)[^\]]{2,40}\]", "unfilled placeholder"),
    (r"\b\d{4}-XX-XX\b", "unfilled date placeholder"),
]

EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]"
)
ABBREV = re.compile(r"\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|approx|Inc|Ltd|Co|U\.S|U\.K|a\.m|p\.m)\.$", re.I)

# --------------------------------------------------------------- text prep


def strip_noise(text: str) -> tuple[str, str]:
    """Return (analysis_text, prose_text).

    analysis_text drops what no one wrote as prose: fenced code, inline code,
    YAML frontmatter, URLs, and blockquotes (usually someone else's words or an
    illustrative example, which is the self-reference escape hatch).

    prose_text additionally drops headings, list items and table rows, so
    rhythm statistics measure sentences rather than bullets.
    """
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"~~~.*?~~~", " ", text, flags=re.S)
    text = re.sub(r"`[^`\n]+`", " ", text)
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    analysis_lines, prose_lines = [], []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(">"):
            continue
        analysis_lines.append(line)
        if not stripped:
            prose_lines.append("")
            continue
        if stripped.startswith("#") or re.match(r"^([-*+]|\d+[.)])\s", stripped):
            continue
        if stripped.startswith("|") or set(stripped) <= set("-|: "):
            continue
        prose_lines.append(line)
    return "\n".join(analysis_lines), "\n".join(prose_lines)


def split_sentences(prose: str) -> list[str]:
    chunks = re.split(r"(?<=[.!?])[\"')\]]*\s+|\n{2,}", prose)
    out: list[str] = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        if out and ABBREV.search(out[-1]):
            out[-1] = f"{out[-1]} {chunk}"
        else:
            out.append(chunk)
    return [s for s in out if re.search(r"[a-zA-Z]", s)]


def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z'-]*", text)


def find(patterns, text: str, flags=re.I) -> list[tuple[str, str]]:
    """Return (label, matched_text) for every hit."""
    hits = []
    for entry in patterns:
        pattern, label = (entry if isinstance(entry, tuple) else (entry, entry))
        for match in re.finditer(pattern, text, flags | re.M):
            hits.append((label, match.group(0).strip()))
    return hits


def quote(text: str, match: str) -> str:
    index = text.lower().find(match.lower())
    if index < 0:
        return match
    start, end = max(0, index - 14), min(len(text), index + len(match) + 20)
    snippet = " ".join(text[start:end].split())
    return f"...{snippet}..."


# ------------------------------------------------------------------ signals


def score_from_counts(strong: int, moderate: int, weak: int) -> int:
    """The A-I rubric: 3 for one strong / two moderate / four weak, and down."""
    if strong >= 1 or moderate >= 2 or weak >= 4:
        return 3
    if moderate >= 1 or weak >= 2:
        return 2
    if weak >= 1:
        return 1
    return 0


def analyze(raw: str, register: str) -> dict:
    analysis, prose = strip_noise(raw)
    sentences = split_sentences(prose)
    lengths = [len(words(s)) for s in sentences]
    all_words = words(analysis)
    word_count = len(all_words) or 1
    per_1k = 1000 / word_count

    paragraphs = [p for p in re.split(r"\n\s*\n", analysis) if p.strip()]
    report: dict = {
        "words": word_count,
        "sentences": len(sentences),
        "paragraphs": len(paragraphs),
        "register": register,
        "hard": [],
        "signals": {},
        "detail": {},
    }
    relaxed = register in {"casual", "docs"}

    # ---- HARD tells: mechanical, countable, no judgment required

    # zero connective dashes, every register, no carve-out: em, en, double
    # hyphen, and the spaced hyphen doing the same job. Hyphenated words
    # (sign-in, high-quality) and list bullets are untouched: the single-space
    # form cannot cross a newline, so `- item` at a line start never matches.
    dashes = list(re.finditer(r"—|–|(?<=\S) -- (?=\S)", analysis))
    dashes += [
        m for m in re.finditer(r"(?<=[\w,;:\"')]) - (?=[\w\"'(])", analysis)
        if not (analysis[m.start() - 1].isdigit() and analysis[m.end()].isdigit())
    ]
    if dashes:
        first = min(dashes, key=lambda m: m.start())
        report["hard"].append({
            "tell": "dash as punctuation", "count": len(dashes),
            "note": "zero allowed anywhere: use a period, a comma, or restructure (hyphenated words are fine)",
            "sample": quote(analysis, analysis[first.start():first.end()]),
        })
    semis = analysis.count(";")
    if semis:
        report["hard"].append({
            "tell": "semicolon", "count": semis,
            "note": "period, or and/but/so, unless a comma-containing list",
        })
    curly = len(re.findall(r"[“”‘’]", analysis))
    if curly and not relaxed:
        report["hard"].append({
            "tell": "curly quote/apostrophe", "count": curly,
            "note": "weak signal on its own (editors auto-curl); strong in plaintext, commits, code comments",
        })
    emoji = EMOJI.findall(analysis)
    if emoji:
        report["hard"].append({"tell": "emoji", "count": len(emoji), "note": "cut from headings and bullets"})
    weird = [c for c in analysis if unicodedata.category(c) == "Cf"]
    if weird:
        report["hard"].append({"tell": "zero-width/invisible char", "count": len(weird),
                               "note": "detector-bypass residue; strip it"})
    for pattern, label in LEAKS:
        found = re.findall(pattern, analysis, re.I)
        if found:
            report["hard"].append({"tell": label, "count": len(found),
                                   "note": "fingerprint, not a style choice; delete"})
    bold = re.findall(r"\*\*[^*\n]{2,60}\*\*", analysis)
    if len(bold) > max(2, len(paragraphs) // 2):
        report["hard"].append({"tell": "bold overuse", "count": len(bold), "note": "one per section at most"})
    hashtags = re.findall(r"(?<!\w)#[A-Za-z][\w]{2,}", analysis)
    if len(hashtags) >= 6:
        report["hard"].append({"tell": "hashtag stuffing", "count": len(hashtags),
                               "note": "2-3 specific tags, or none"})
    label_periods = re.findall(r"^\s*[-*+]\s+\*\*[^*]{2,40}\.\*\*\s", analysis, re.M)
    if label_periods:
        report["hard"].append({"tell": "list-label period", "count": len(label_periods),
                               "note": "a person writes `**Label:** gloss`"})
    title_case = [
        h for h in re.findall(r"^#{2,6}\s+(.+)$", analysis, re.M)
        if len(h.split()) >= 3 and sum(1 for w in h.split()[1:] if w[:1].isupper()) >= len(h.split()) - 1
    ]
    if title_case:
        report["hard"].append({"tell": "Title Case heading", "count": len(title_case),
                               "note": "sentence case for subheads", "sample": title_case[0]})

    # ---- Signal A: vocabulary / perplexity
    t1 = find(TIER1, analysis)
    t2_by_para = []
    for para in paragraphs:
        hits = {match.lower() for _, match in find(TIER2, para)}
        if len(hits) >= 2:
            t2_by_para.append(sorted(hits))
    t3 = find(TIER3, analysis)
    t3_density = 100 * len(t3) / word_count
    report["detail"]["tier1"] = [m for _, m in t1]
    report["detail"]["tier2_clusters"] = t2_by_para
    report["detail"]["tier3_density_pct"] = round(t3_density, 2)
    report["signals"]["A perplexity/vocabulary"] = score_from_counts(
        strong=1 if len(t1) * per_1k >= 6 else 0,
        moderate=len(t2_by_para) + (1 if t3_density >= 3 else 0),
        weak=len(t1),
    )

    # ---- Signal B: burstiness
    burst = {}
    if len(lengths) >= 4:
        spread = max(lengths) - min(lengths)
        band = sum(1 for n in lengths if 10 <= n <= 20) / len(lengths)
        # a run of short sentences is rhythm; the tell is mid-length metronome
        run = best = 1
        for prev, cur in zip(lengths, lengths[1:]):
            uniform = abs(cur - prev) <= 5 and min(prev, cur) >= 10
            run = run + 1 if uniform else 1
            best = max(best, run)
        burst = {
            "lengths": lengths,
            "mean": round(statistics.fmean(lengths), 1),
            "stdev": round(statistics.pstdev(lengths), 1),
            "spread": spread,
            "mid_band_pct": round(100 * band),
            "longest_run_within_5": best,
            "shortest": min(lengths),
            "longest": max(lengths),
        }
        fails = [
            spread < 20 and word_count > 80,
            band >= 0.5,
            best >= 3,
            statistics.pstdev(lengths) < 8 and word_count > 80,
            min(lengths) > 6 and word_count > 150,
        ]
        report["signals"]["B burstiness"] = min(3, sum(1 for f in fails if f))
    else:
        report["signals"]["B burstiness"] = 0
    report["detail"]["rhythm"] = burst

    para_sentences = [len(split_sentences(p)) for p in paragraphs if split_sentences(p)]
    if len(para_sentences) >= 3:
        report["detail"]["paragraph_sentences"] = para_sentences
        if statistics.pstdev(para_sentences) < 0.8:
            report["detail"]["paragraph_uniformity"] = "every paragraph is the same size"

    # ---- Signal C: hedges
    hedges = find(HEDGES, analysis)
    report["detail"]["hedges"] = [m for _, m in hedges]
    report["signals"]["C hedge density"] = score_from_counts(
        strong=1 if len(hedges) * per_1k >= 12 else 0, moderate=len(hedges) // 3, weak=len(hedges),
    )

    # ---- Signal D: structure
    bullets = len(re.findall(r"^\s*(?:[-*+]|\d+[.)])\s", analysis, re.M))
    headings = len(re.findall(r"^#{1,6}\s", analysis, re.M))
    bullet_np = 0
    run = 0
    for line in analysis.splitlines():
        item = re.match(r"^\s*[-*+]\s+(.{2,60})$", line)
        if item and len(item.group(1).split()) <= 6 and not re.search(
            r"\b(?:is|are|was|were|has|have|does|do|can|will|adds?|uses?|runs?|makes?)\b", item.group(1), re.I
        ):
            run += 1
            bullet_np = max(bullet_np, run)
        else:
            run = 0
    structure_flags = []
    if bullets * per_1k > 25:
        structure_flags.append(f"{bullets} list items in {word_count} words")
    if headings >= 4 and word_count < 300:
        structure_flags.append(f"{headings} headings in {word_count} words")
    if bullet_np >= 5:
        structure_flags.append(f"{bullet_np} consecutive bare noun-phrase bullets")
    if re.search(r"^#{1,6}\s*(?:Overview|Key Points|Summary|Conclusion|Introduction|Challenges and)\b",
                 analysis, re.M | re.I):
        structure_flags.append("boilerplate section header")
    if re.search(r"\b(?:three|four|five|\d+) (?:key )?(?:takeaways|things to know|reasons|ways|steps)\b",
                 analysis, re.I):
        structure_flags.append("numbered-list inflation")
    report["detail"]["structure"] = structure_flags
    report["signals"]["D structure"] = min(2 if relaxed else 3, len(structure_flags))

    # ---- Signal E: specificity anchors (from prose, so headings do not count)
    numbers = len(re.findall(r"\b\d[\d,.]*\s*(?:%|[a-z]{1,6})?\b", prose))
    propers = len({w for w in re.findall(r"(?<![.!?]\s)(?<!^)\b[A-Z][a-zA-Z]{2,}\b", prose, re.M)})
    dates = len(re.findall(
        r"\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b"
        r"|\b(?:yesterday|last (?:week|month|quarter|year)|this morning)\b", prose, re.I))
    anchors = numbers + propers + dates
    anchor_rate = anchors * per_1k
    report["detail"]["anchors"] = {"numbers": numbers, "named": propers, "dates": dates,
                                   "per_1000_words": round(anchor_rate, 1)}
    report["signals"]["E specificity"] = (
        3 if anchor_rate < 8 else 2 if anchor_rate < 16 else 1 if anchor_rate < 25 else 0
    )

    # ---- Signal F: transitions
    trans = find(TRANSITIONS, analysis)
    openers = len(re.findall(r"^(?:furthermore|moreover|additionally|in conclusion|in summary)\b",
                             analysis, re.I | re.M))
    report["detail"]["transitions"] = [m for _, m in trans]
    report["signals"]["F transitions"] = score_from_counts(
        strong=1 if openers >= 2 else 0, moderate=openers + len(trans) // 4, weak=len(trans),
    )

    # ---- Signal G: punctuation
    mid_colon = re.findall(r"^[^.!?\n]{0,40}:\s+\S", analysis, re.M)
    dash_rate = len(dashes) * per_1k
    report["detail"]["punctuation"] = {
        "dashes": len(dashes), "per_1000_words": round(dash_rate, 1),
        "semicolons": semis, "curly": curly, "announcement_colons": len(mid_colon),
    }
    report["signals"]["G punctuation"] = score_from_counts(
        strong=1 if dash_rate > 3 else 0,
        moderate=(1 if dashes else 0) + (1 if semis else 0) + (1 if len(mid_colon) >= 3 else 0),
        weak=(1 if curly and not relaxed else 0),
    )

    # ---- Signal H: voice and register
    first = len(re.findall(r"\b(?:I|I'?m|I'?ve|my|we|our)\b", analysis))
    second = len(re.findall(r"\b(?:you|your|you'?re|you'?ll)\b", analysis, re.I))
    chat = find(CHATBOT, analysis)
    contractions = len(re.findall(r"\b\w+'(?:s|t|re|ve|ll|d|m)\b", analysis))
    voice_flags = []
    if word_count > 150 and first == 0 and second == 0:
        voice_flags.append("no first or second person anywhere")
    if word_count > 200 and contractions == 0 and not relaxed:
        voice_flags.append("zero contractions")
    if chat:
        voice_flags.append("chat artifacts: " + ", ".join(sorted({m for _, m in chat}))[:80])
    report["detail"]["voice"] = voice_flags
    report["signals"]["H voice/register"] = score_from_counts(
        strong=1 if chat else 0, moderate=len(voice_flags), weak=0,
    )

    # ---- Signal I: rhetorical scaffolding
    scaffold = find(SCAFFOLD, analysis)
    filler = find(FILLER, analysis)
    grouped: dict[str, list[str]] = {}
    for label, match in scaffold:
        grouped.setdefault(label, []).append(match)
    report["detail"]["scaffolding"] = {k: v[:3] for k, v in grouped.items()}
    report["detail"]["filler"] = [m for _, m in filler]

    anaphora = []
    for prev, cur in zip(sentences, sentences[1:]):
        a, b = words(prev)[:1], words(cur)[:1]
        if a and b and a[0].lower() == b[0].lower() and len(a[0]) > 2:
            anaphora.append(a[0].lower())
    if anaphora:
        report["detail"]["anaphora"] = sorted(set(anaphora))
    report["signals"]["I scaffolding"] = score_from_counts(
        strong=1 if len(grouped) >= 4 else 0, moderate=len(grouped), weak=len(anaphora) + len(filler),
    )

    # ---- vocabulary diversity
    lower = [w.lower() for w in all_words]
    ttr = len(set(lower)) / len(lower) if lower else 0
    report["detail"]["ttr"] = round(ttr, 3)
    if word_count >= 200 and ttr < 0.40:
        report["detail"].setdefault("structure", []).append(f"low vocabulary diversity (TTR {ttr:.2f})")

    total = sum(report["signals"].values())
    report["score"] = total
    report["verdict"] = (
        "Human" if total <= 4 else "Likely human" if total <= 8 else
        "Uncertain" if total <= 13 else "Likely AI" if total <= 19 else "AI"
    )
    if word_count < 100:
        report["calibration"] = "under 100 words: few signals available, cap confidence at medium"
    return report


# ------------------------------------------------------------------- output

JUDGMENT = [
    "invented facts (nothing in the rewrite may be absent from the source)",
    "synonym cycling for one referent",
    "promotional or brochure register",
    'self-labeling significance ("that last one is the clever bit")',
    "paragraph-reshuffle immunity (can two paragraphs swap with no damage?)",
    "treadmill paragraphs that restate instead of advancing",
    "mini-aphorism closers and chiasmus that read as good writing",
    "whether a flagged word is simply the right word here",
]


def render(report: dict) -> str:
    out = [
        f"{report['words']} words, {report['sentences']} sentences, {report['paragraphs']} paragraphs"
        f"  [register: {report['register']}]",
        "",
        f"SCORE {report['score']}/27 -> {report['verdict']}",
    ]
    if "calibration" in report:
        out.append(f"  ! {report['calibration']}")
    out.append("")

    if report["hard"]:
        out.append("HARD TELLS (mechanical, fix every one)")
        for item in report["hard"]:
            out.append(f"  {item['tell']:<28} {item['count']:>3}   {item['note']}")
            if item.get("sample"):
                out.append(f"  {'':<28}       {item['sample']}")
    else:
        out.append("HARD TELLS  none")
    out.append("")

    out.append("SIGNALS")
    for name, value in report["signals"].items():
        out.append(f"  {name:<26} {'#' * value}{'.' * (3 - value)}  {value}")
    out.append("")

    detail = report["detail"]
    rhythm = detail.get("rhythm") or {}
    if rhythm:
        out.append("RHYTHM")
        out.append(f"  lengths  {', '.join(str(n) for n in rhythm['lengths'][:40])}"
                   + (" ..." if len(rhythm["lengths"]) > 40 else ""))
        out.append(f"  mean {rhythm['mean']}  sd {rhythm['stdev']} (want >8)  "
                   f"spread {rhythm['spread']} (want >=20)  "
                   f"10-20 band {rhythm['mid_band_pct']}% (want <50)  "
                   f"longest same-length run {rhythm['longest_run_within_5']} (want <3)")
        if detail.get("paragraph_uniformity"):
            out.append(f"  paragraphs {detail.get('paragraph_sentences')}: {detail['paragraph_uniformity']}")
        out.append("")

    def section(title: str, items) -> None:
        if not items:
            return
        out.append(title)
        if isinstance(items, dict):
            for key, value in items.items():
                out.append(f"  {key:<28} {', '.join(map(str, value))[:96]}")
        elif isinstance(items, list):
            out.append("  " + ", ".join(map(str, items))[:400])
        out.append("")

    section("VOCABULARY (tier 1)", detail.get("tier1"))
    if detail.get("tier2_clusters"):
        section("TIER-2 CLUSTERS (2+ in one paragraph)",
                {f"para {i + 1}": c for i, c in enumerate(detail["tier2_clusters"])})
    section("SCAFFOLDING", detail.get("scaffolding"))
    section("HEDGES", detail.get("hedges"))
    section("TRANSITIONS", detail.get("transitions"))
    section("FILLER", detail.get("filler"))
    section("ANAPHORA (same sentence opener)", detail.get("anaphora"))
    section("STRUCTURE", detail.get("structure"))
    section("VOICE", detail.get("voice"))

    anchors = detail.get("anchors") or {}
    ttr = (f"TTR {detail.get('ttr')} (human prose ~0.50-0.65)" if report["words"] >= 200
           else "TTR n/a under 200 words")
    out.append(f"SPECIFICITY  {anchors.get('per_1000_words', 0)} anchors/1000 words "
               f"(numbers {anchors.get('numbers')}, named {anchors.get('named')}, "
               f"dates {anchors.get('dates')})   {ttr}")
    out.append("")
    out.append("NOT CHECKED HERE (read for these yourself):")
    out.extend(f"  - {item}" for item in JUDGMENT)
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan text for mechanical AI-writing tells.")
    parser.add_argument("path", help="file to scan, or - for stdin")
    parser.add_argument("--json", action="store_true", help="emit the raw report")
    parser.add_argument("--register", default="blog",
                        choices=["blog", "technical", "docs", "social", "email", "casual"],
                        help="relaxes register-scoped rules (casual/docs); the dash rule never relaxes")
    parser.add_argument("--strict", action="store_true", help="exit 1 if any hard tell survives")
    args = parser.parse_args()

    raw = sys.stdin.read() if args.path == "-" else open(args.path, encoding="utf-8").read()
    report = analyze(raw, args.register)
    print(json.dumps(report, indent=2) if args.json else render(report))
    return 1 if (args.strict and report["hard"]) else 0


if __name__ == "__main__":
    sys.exit(main())
