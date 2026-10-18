import tryCatch from "@repo/shared/try-catch"
import { desc, eq } from "drizzle-orm"
import type { Db } from "@/database/client"
import { notes } from "@/database/schema"
import { CustomError } from "@/http/errors"

/** A note as callers see it: the row, with the date as epoch ms. */
export type Note = {
  id: string
  body: string
  createdAt: number
}

const NOTE_COLUMNS = {
  id: notes.id,
  body: notes.body,
  createdAt: notes.createdAt,
}

type NoteRow = {
  id: string
  body: string
  createdAt: Date
}

function toNote(row: NoteRow): Note {
  return { id: row.id, body: row.body, createdAt: row.createdAt.getTime() }
}

//---- service ----------------

export class NotesService {
  constructor(private db: Db) {}

  /** Stores a note, stamped with the server's clock. */
  async create(body: string): Promise<Note> {
    const row = { id: crypto.randomUUID(), body, createdAt: new Date() }
    const [, insertError] = await tryCatch(() =>
      this.db.insert(notes).values(row),
    )
    if (insertError)
      throw new CustomError("internal_server_error", insertError)
    return toNote(row)
  }

  /** Every note, newest first. */
  async getAll(): Promise<Note[]> {
    const [rows, selectError] = await tryCatch(() =>
      this.db
        .select(NOTE_COLUMNS)
        .from(notes)
        .orderBy(desc(notes.createdAt)),
    )
    if (selectError)
      throw new CustomError("internal_server_error", selectError)
    return rows.map(toNote)
  }

  /** One note, or null when there is none with that id. */
  async findById(id: string): Promise<Note | null> {
    const [row, selectError] = await tryCatch(() =>
      this.db
        .select(NOTE_COLUMNS)
        .from(notes)
        .where(eq(notes.id, id))
        .get(),
    )
    if (selectError)
      throw new CustomError("internal_server_error", selectError)
    return row ? toNote(row) : null
  }

  /** One note; a missing one is `not_found`, which the route never handles. */
  async getById(id: string): Promise<Note> {
    const note = await this.findById(id)
    if (!note) throw new CustomError("not_found")
    return note
  }
}
