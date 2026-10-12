import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import type { Language } from "@/i18n"

/**
 * Each flag drawn on a 30x20 field. Simplified where the real one carries a
 * crest or fine detail: at 20px wide a coat of arms is a smudge, and the colours
 * and their layout are what make it read.
 */
const FLAG_ART: Record<Language, ReactNode> = {
  en: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.4" />
    </>
  ),
  de: (
    <>
      <rect width="30" height="20" fill="#FFCE00" />
      <rect width="30" height="13.34" fill="#DD0000" />
      <rect width="30" height="6.67" fill="#000" />
    </>
  ),
  fr: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#002395" />
      <rect x="20" width="10" height="20" fill="#ED2939" />
    </>
  ),
  es: (
    <>
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </>
  ),
  it: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#009246" />
      <rect x="20" width="10" height="20" fill="#CE2B37" />
    </>
  ),
  pt: (
    <>
      <rect width="30" height="20" fill="#FF0000" />
      <rect width="12" height="20" fill="#006600" />
      <circle cx="12" cy="10" r="4" fill="#FFCC00" />
      <circle cx="12" cy="10" r="2.4" fill="#FF0000" />
    </>
  ),
  nl: (
    <>
      <rect width="30" height="20" fill="#21468B" />
      <rect width="30" height="13.34" fill="#fff" />
      <rect width="30" height="6.67" fill="#AE1C28" />
    </>
  ),
  pl: (
    <>
      <rect width="30" height="20" fill="#DC143C" />
      <rect width="30" height="10" fill="#fff" />
    </>
  ),
  ja: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ),
  zh: (
    <>
      <rect width="30" height="20" fill="#EE1C25" />
      <path
        d="M5 2L5.67 4.07L7.85 4.07L6.09 5.35L6.76 7.43L5 6.15L3.24 7.43L3.91 5.35L2.15 4.07L4.33 4.07z"
        fill="#FFFF00"
      />
      <circle cx="10" cy="2" r="0.9" fill="#FFFF00" />
      <circle cx="12" cy="4" r="0.9" fill="#FFFF00" />
      <circle cx="12" cy="7" r="0.9" fill="#FFFF00" />
      <circle cx="10" cy="9" r="0.9" fill="#FFFF00" />
    </>
  ),
  ko: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="5" fill="#0047A0" />
      <path
        d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0z"
        fill="#CD2E3A"
      />
      <g stroke="#000" strokeWidth="1.2">
        <path d="M4 4.5l3-3M5 5.5l3-3" />
        <path d="M22 14.5l3 3M23 13.5l3 3" />
        <path d="M22 5.5l3-3M23 6.5l3-3" />
        <path d="M4 15.5l3 3M5 14.5l3 3" />
      </g>
    </>
  ),
  hi: (
    <>
      <rect width="30" height="20" fill="#138808" />
      <rect width="30" height="13.34" fill="#fff" />
      <rect width="30" height="6.67" fill="#FF9933" />
      <circle
        cx="15"
        cy="10"
        r="2.6"
        fill="none"
        stroke="#000080"
        strokeWidth="0.8"
      />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </>
  ),
  tr: (
    <>
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="11" cy="10" r="5" fill="#fff" />
      <circle cx="12.25" cy="10" r="4" fill="#E30A17" />
      <path
        d="M15.1 10L16.69 9.48L16.69 7.81L17.67 9.16L19.26 8.65L18.28 10L19.26 11.35L17.67 10.84L16.69 12.19L16.69 10.52z"
        fill="#fff"
      />
    </>
  ),
}

/**
 * A language's flag, drawn rather than typed.
 *
 * Flag emoji are two regional-indicator letters that a font may or may not join
 * into a flag. Windows and most Linux ship no font that does, so "🇬🇧" there is
 * the letters "GB" in a box. An inline SVG looks the same everywhere and costs
 * no request.
 */
export function LanguageFlag({
  language,
  className,
}: {
  language: Language
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 30 20"
      aria-hidden="true"
      className={cn(
        "h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px]",
        className,
      )}
    >
      {FLAG_ART[language]}
    </svg>
  )
}
