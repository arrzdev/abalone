import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { ItemList } from "@/components/items/item-list"
import { ItemsHeader } from "@/components/items/items-header"
import { PageWithSmoothEdges } from "@/components/page"
import { IconButton, TextInput } from "@/components/ui"
import {
  createItem,
  deleteItem,
  setItemDone,
} from "@/data/collections/items/mutations"
import { useItems } from "@/data/collections/items/queries"
import type { Item } from "@/data/collections/items/schema"
import { useAppVibrate } from "@/hooks/use-app-vibrate"
import { useDataMutation } from "@/hooks/use-data-mutation"
import { GlobalLoginDrawer } from "@/providers/auth-provider"

export const Route = createFileRoute("/")({
  component: HomePage,
})

//---- Home page ----------------------------------------------------
//the worked example: a synced collection driven end to end. writes are
//optimistic local synq writes (data/collections/items/mutations) and the sync
//controller flushes them once signed in. delete this page and its components
//when you start the real app — keep the shape.

function HomePage() {
  const { data: items, isLoading } = useItems()
  const { vibrateOk } = useAppVibrate()
  const [draft, setDraft] = useState("")
  const mutation = useDataMutation()

  async function handleCreate() {
    const title = draft.trim()
    if (!title) return
    vibrateOk()
    const created = await mutation.run(
      () => createItem(title),
      "Could not add that item.",
    )
    if (created) setDraft("")
  }

  function handleToggle(item: Item, done: boolean) {
    void mutation.run(
      () => setItemDone(item.id, done),
      "Could not update that item.",
    )
  }

  function handleDelete(item: Item) {
    void mutation.run(
      () => deleteItem(item.id),
      "Could not delete that item.",
    )
  }

  return (
    <PageWithSmoothEdges>
      {/* Login drawer rendered here (page/outlet scope) — NOT in AuthProvider —
          so its autofocus can raise the iOS keyboard. See GlobalLoginDrawer. */}
      <GlobalLoginDrawer />

      <ItemsHeader count={items.length} isLoading={isLoading} />

      <div className="flex items-center gap-x-2">
        <TextInput
          value={draft}
          onChange={setDraft}
          onSubmit={() => void handleCreate()}
          placeholder="Add an item"
          enterKeyHint="done"
          aria-label="Item title"
          className="flex-1"
        />
        <IconButton
          onClick={() => void handleCreate()}
          aria-label="Add item"
          disabled={draft.trim().length === 0}
          className="bg-primary text-primary-foreground hover:bg-accent"
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden />
        </IconButton>
      </div>

      {mutation.error && (
        <p role="alert" className="text-sm text-error">
          {mutation.error.message}
        </p>
      )}

      <ItemList
        items={items}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />
    </PageWithSmoothEdges>
  )
}
