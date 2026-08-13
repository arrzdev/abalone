import { Trash2 } from "lucide-react"
import { Checkbox, IconButton } from "@/components/ui"
import type { Item } from "@/data/collections/items/schema"
import { useAppVibrate } from "@/hooks/use-app-vibrate"

type ItemListProps = {
  items: Item[]
  onToggle: (item: Item, done: boolean) => void
  onDelete: (item: Item) => void
}

export function ItemList({ items, onToggle, onDelete }: ItemListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-md bg-surface px-4 py-8 text-center text-sm text-muted">
        Nothing here yet. Add the first one above.
      </p>
    )
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-md bg-surface">
      {items.map((item, index) => (
        <ItemRow
          key={item.id}
          item={item}
          showSeparator={index < items.length - 1}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}

type ItemRowProps = {
  item: Item
  showSeparator: boolean
  onToggle: (item: Item, done: boolean) => void
  onDelete: (item: Item) => void
}

function ItemRow({
  item,
  showSeparator,
  onToggle,
  onDelete,
}: ItemRowProps) {
  const { vibrateOk, hapticPointerHandlers } = useAppVibrate()
  const deleteHandlers = hapticPointerHandlers(
    () => onDelete(item),
    "cancel",
  )

  return (
    <li>
      <div className="flex items-center gap-x-3 px-4 py-3">
        <Checkbox
          checked={item.done}
          onCheckedChange={(done) => {
            vibrateOk()
            onToggle(item, done)
          }}
          aria-label={item.title}
        />
        <span
          className={
            item.done
              ? "min-w-0 flex-1 truncate text-base text-muted line-through"
              : "min-w-0 flex-1 truncate text-base text-foreground"
          }
        >
          {item.title}
        </span>
        <IconButton
          onClick={deleteHandlers.onClick}
          aria-label={`Delete ${item.title}`}
          className="size-9 bg-transparent text-subtle hover:bg-secondary"
        >
          <Trash2 size={18} strokeWidth={1.75} aria-hidden />
        </IconButton>
      </div>
      {showSeparator && (
        <div className="mx-4 border-b border-border-subtle" aria-hidden />
      )}
    </li>
  )
}
