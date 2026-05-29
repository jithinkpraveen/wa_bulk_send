import { parse } from "https://deno.land/std@0.218.2/csv/mod.ts";
import { Database } from "./database.types.ts";

export type ContactTagInsert = Database['public']['Tables']['contact_tag']['Insert']
export type ContactInsert = Database['public']['Tables']['contacts']['Insert']

// WhatsApp wa_id is the full phone number in digits only: country code + number,
// without '+', spaces, dashes or parentheses.
export function sanitizeNumber(raw: string | undefined): string {
  return (raw ?? '').replace(/[^0-9]/g, '')
}

export function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0)
}

export type ParsedContacts = {
  contacts: ContactInsert[]
  tagNames: string[]
  skipped: { row: number, reason: string }[]
}

// Parses a contacts CSV (columns: name, number, tags) into de-duplicated contact
// rows. `extraTags` are added to every parsed contact (e.g. a broadcast name used
// as an auto-tag). The returned `contacts` carry only the CSV-derived tags; callers
// that must preserve a contact's existing tags should merge before upserting.
export function parseContactsCsv(csvData: string, extraTags: string[] = []): ParsedContacts {
  const rows = parse(csvData, {
    skipFirstRow: true,
    strip: true,
    columns: ["name", "number", "tags"],
  })

  const contactsByWaId = new Map<string, ContactInsert>()
  const tagNameSet = new Set<string>(extraTags)
  const skipped: { row: number, reason: string }[] = []

  rows.forEach((row, index) => {
    const wa_id = sanitizeNumber(row.number)
    if (!wa_id) {
      skipped.push({ row: index + 2, reason: 'missing or invalid number' }) // +2: header + 1-based
      return
    }
    if (wa_id.length > 15) {
      skipped.push({ row: index + 2, reason: 'number too long' })
      return
    }
    const tags = Array.from(new Set([...parseTags(row.tags), ...extraTags]))
    tags.forEach((tag) => tagNameSet.add(tag))
    contactsByWaId.set(wa_id, {
      wa_id: Number(wa_id),
      profile_name: row.name?.trim() || null,
      tags: tags.length > 0 ? tags : null,
    })
  })

  return {
    contacts: Array.from(contactsByWaId.values()),
    tagNames: Array.from(tagNameSet),
    skipped,
  }
}
