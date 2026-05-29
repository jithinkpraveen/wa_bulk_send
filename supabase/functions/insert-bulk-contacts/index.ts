// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from "../_shared/client.ts";
import { parseContactsCsv } from "../_shared/contacts-csv.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorizationHeader = req.headers.get('Authorization')!
    const supabase = createSupabaseClient(authorizationHeader)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const csvData = await req.text()
    const { contacts, tagNames, skipped } = parseContactsCsv(csvData)

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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to import contacts' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }
})

// To invoke:
// curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/insert-bulk-contacts' \
//   --header 'Authorization: Bearer <token>' \
//   --header 'Content-Type: text/csv' \
//   --data-binary $'Name,Number,Tags\nJohn,15551234567,"vip,lead"'
