// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceRoleClient, getBearerToken } from "../_shared/client.ts";
import { parseContactsCsv } from "../_shared/contacts-csv.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Service-role client (bypasses the admin-only contacts RLS); the caller is
    // still verified via their bearer token.
    const supabase = createServiceRoleClient()
    const token = getBearerToken(req.headers.get('Authorization'))

    const {
      data: { user },
    } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    // Body is either JSON `{ csvData, tags }` (tags applied to every contact) or
    // a raw CSV string (older callers).
    const raw = await req.text()
    let csvData = raw
    let extraTags: string[] = []
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'csvData' in parsed) {
        csvData = parsed.csvData ?? ''
        if (Array.isArray(parsed.tags)) extraTags = parsed.tags
      }
    } catch (_) {
      // not JSON — treat the body as raw CSV
    }

    const { contacts, tagNames, skipped } = parseContactsCsv(csvData, extraTags)

    if (tagNames.length > 0) {
      const { error: contactTagsInsertError } = await supabase
        .from('contact_tag')
        .upsert(tagNames.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
      if (contactTagsInsertError) throw contactTagsInsertError
    }

    if (contacts.length > 0) {
      const { error: contactInsertError } = await supabase
        .from('contacts')
        .upsert(contacts, { onConflict: 'wa_id' })
      if (contactInsertError) throw contactInsertError
    }

    return new Response(
      JSON.stringify({ inserted: contacts.length, tags: tagNames.length, skipped }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  } catch (e) {
    console.error('insert-bulk-contacts failed', e)
    let message = 'Failed to import contacts'
    if (e instanceof Error) {
      message = e.message
    } else if (e && typeof e === 'object') {
      const o = e as { message?: string; details?: string; hint?: string; code?: string }
      message = o.message || o.details || o.hint || JSON.stringify(e)
      if (o.code) message = `[${o.code}] ${message}`
    }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }
})

// To invoke:
// curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/insert-bulk-contacts' \
//   --header 'Authorization: Bearer <token>' \
//   --header 'Content-Type: text/csv' \
//   --data-binary $'Name,Number,Tags\nJohn,15551234567,"vip,lead"'
