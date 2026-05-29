import { serve } from "deno-server";
import { Response } from "https://esm.sh/v133/@supabase/node-fetch@2.6.14/denonext/node-fetch.mjs";
import { SupabaseClientType, createSupabaseClient } from "../_shared/client.ts";
import { PARALLEL_BATCH_COUNT, PROCESSING_LIMIT } from "../_shared/constants.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { runInBackground } from "../_shared/background.ts";
import { TemplateParameters } from "../_shared/template-components.ts";
import { Json } from "../_shared/database.types.ts";
import { parseContactsCsv } from "../_shared/contacts-csv.ts";
import { getMessageTemplate } from "./get-message-template.ts";

type BulkSendRequest = {
  name: string,
  messageTemplate: string,
  language: string,
  contactTags: string[],
  templateParameters?: TemplateParameters | null,
  // When provided, contacts are imported from this CSV and auto-tagged with the
  // broadcast name; the broadcast is then sent to that tag.
  csvData?: string,
}

// Imports CSV contacts, tags each with `broadcastName`, and MERGES with any
// existing tags so a re-import never wipes a contact's other tags.
async function importCsvContacts(supabase: SupabaseClientType, csvData: string, broadcastName: string) {
  const { contacts, tagNames } = parseContactsCsv(csvData, [broadcastName])
  if (tagNames.length > 0) {
    const { error } = await supabase
      .from('contact_tag')
      .upsert(tagNames.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
    if (error) throw error
  }
  if (contacts.length === 0) return
  const waIds = contacts.map((c) => c.wa_id)
  const { data: existing, error: existingErr } = await supabase
    .from('contacts')
    .select('wa_id, tags')
    .in('wa_id', waIds)
  if (existingErr) throw existingErr
  const existingTags = new Map<string, string[]>()
  for (const e of existing ?? []) existingTags.set(e.wa_id.toString(), e.tags ?? [])
  const merged = contacts.map((c) => {
    const prev = existingTags.get(c.wa_id!.toString()) ?? []
    const tags = Array.from(new Set([...prev, ...(c.tags ?? [])]))
    return { ...c, tags: tags.length > 0 ? tags : null }
  })
  const { error } = await supabase.from('contacts').upsert(merged, { onConflict: 'wa_id' })
  if (error) throw error
}

async function markContactsForSend(supabase: SupabaseClientType, broadcastId: string, tags: string[]) {
  let from = 0
  let lastFetchedCount;
  let scheduledCount = 0;
  const batches = []
  do {
    const batchId = crypto.randomUUID()
    const to = from + PROCESSING_LIMIT - 1
    console.log(`BroadcastId: ${broadcastId} - Analyzing contacts to send message ${from} ${to}...`)
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true })
      .overlaps('tags', tags)
      .range(from, to)
    if (error) throw error
    const broadcastContacts = contacts.map((item) => {
      return {
        broadcast_id: broadcastId,
        contact_id: item.wa_id,
        batch_id: batchId
      }
    })
    if (broadcastContacts.length > 0) {
      const { error: errorContactInsert } = await supabase
        .from('broadcast_contact')
        .insert(broadcastContacts)
      if (errorContactInsert) throw errorContactInsert
      batches.push(batchId)
      const { error: errorBatchInsert } = await supabase.from('broadcast_batch').insert({
        'id': batchId,
        'broadcast_id': broadcastId,
        'scheduled_count': contacts.length,
      })
      if (errorBatchInsert) throw errorBatchInsert
    }
    lastFetchedCount = contacts.length
    scheduledCount += contacts.length
    from = from + PROCESSING_LIMIT
  } while (lastFetchedCount == PROCESSING_LIMIT)
  return { scheduledCount, batches }
}

// deno-lint-ignore no-explicit-any
async function startBroadcast(supabase: SupabaseClientType, broadcast: any, requestData: BulkSendRequest) {
  const broadcastId: string = broadcast.id
  // CSV mode: import + auto-tag the uploaded contacts, then target that tag.
  let tags = requestData.contactTags
  if (requestData.csvData) {
    await importCsvContacts(supabase, requestData.csvData, broadcast.name)
    tags = [broadcast.name]
  }
  const contactsMarkedForSent = await markContactsForSend(supabase, broadcastId, tags)
  console.log(`BroadcastId: ${broadcastId} - ${contactsMarkedForSent.scheduledCount} contacts marked for send`)

  const { error: errorUpdateBroadcastSC } = await supabase
    .from('broadcast')
    .update({ scheduled_count: contactsMarkedForSent.scheduledCount })
    .eq('id', broadcastId)
  if (errorUpdateBroadcastSC) throw errorUpdateBroadcastSC

  let messageTemplate = null
  try {
    messageTemplate = await getMessageTemplate(requestData.messageTemplate, requestData.language)
  } catch (e) {
    // Template metadata is only used for storage/display; sending uses the saved
    // parameter bindings, so a fetch failure must not abort the broadcast.
    console.error(`BroadcastId: ${broadcastId} - could not fetch template metadata`, e)
  }

  const workers = Math.min(PARALLEL_BATCH_COUNT, contactsMarkedForSent.batches.length)
  // Invoke workers in parallel; one failed invocation must not prevent the others.
  const results = await Promise.allSettled(
    Array.from({ length: workers }, () =>
      supabase.functions.invoke('send-message-batch', {
        body: {
          broadcast: broadcast,
          messageTemplate: messageTemplate
        }
      })
    )
  )
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`BroadcastId: ${broadcastId} - worker ${i} invoke failed`, r.reason)
    }
  })
  console.log(`BroadcastId: ${broadcastId} - ${workers} workers invoked`)
}

serve(async (req) => {
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
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      )
    }
    const requestData: BulkSendRequest = await req.json()

    // In CSV mode the audience is the auto-created tag named after the broadcast.
    const effectiveTags = requestData.csvData ? [requestData.name] : requestData.contactTags

    const { data: broadcast, error } = await supabase
      .from('broadcast')
      .insert([
        {
          name: requestData.name,
          template_name: requestData.messageTemplate,
          contact_tags: effectiveTags,
          language: requestData.language,
          template_parameters: (requestData.templateParameters ?? null) as Json,
        },
      ])
      .select()
    if (error) throw error
    if (!broadcast || broadcast.length <= 0) {
      throw new Error(`failed to create broadcast. name: ${requestData.name} template_name: ${requestData.messageTemplate}`)
    }
    const broadcastId: string = broadcast[0].id
    console.log(`Broadcast created - ${broadcastId}`)

    // Mark contacts + fan out workers in the background so this responds quickly.
    runInBackground(startBroadcast(supabase, broadcast[0], requestData))

    return new Response(
      JSON.stringify({ success: true, broadcastId }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  } catch (e) {
    console.error('bulk-send failed', e)
    const message = e instanceof Error ? e.message : 'Failed to start broadcast'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }
})
