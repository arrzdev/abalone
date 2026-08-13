//---- First-run seed -----------------------------------------------
//the hook the app-db provider awaits before the shell drops its splash, and
//that sign-out re-runs after wiping the local store. it is a no-op in the
//boilerplate — fill it in when your app needs first-run rows.
//
//seeding a SYNCED collection needs deterministic ids, or two devices that
//both run their first launch offline each create their own copy and the CRDT
//merge keeps both. give every seeded row a fixed `$id` and use an
//emptiness check so a re-run can't duplicate:
//
//  const existing = await store.items.query()
//  if (existing.length > 0) return
//  await store.items.insert({ $id: "item-welcome", … })

export function seedInitialDataIfEmpty(): Promise<void> {
  return Promise.resolve()
}
