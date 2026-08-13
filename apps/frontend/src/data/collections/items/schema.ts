import { z } from "zod"

//the UI-facing shape: dates as Date, ids as a flat `id`. the synced row
//(SyncItem) keeps epoch ms — queries.ts maps between them.
export const itemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  done: z.boolean(),
  position: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Item = z.infer<typeof itemSchema>
