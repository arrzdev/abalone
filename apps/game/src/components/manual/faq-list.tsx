import type { ReactNode } from "react"

/** One question and its answer, as the page shows them. */
export type FaqItem = {
  id: string
  question: string
  answer: ReactNode
}

/**
 * The questions of a "Frequently asked" chapter. Each page's FAQPage markup is
 * built from the same copy (`structured-data.ts`), so the two say the same.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <dl className="flex flex-col">
      {items.map((item) => (
        <div
          key={item.id}
          className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
        >
          <dt className="text-[17px] font-semibold text-foreground">
            {item.question}
          </dt>
          {/* A paragraph, because that is what an answer is: a link in one is
              part of its sentence, the height of its line, not a control
              standing on its own. */}
          <dd className="mt-1">
            <p>{item.answer}</p>
          </dd>
        </div>
      ))}
    </dl>
  )
}
