import { serve } from "deno-server"
import { corsHeaders } from "../_shared/cors.ts";
import { Broadcast, BroadcastContact } from "../bulk-send/types.ts";
import { SupabaseClientType, createSupabaseClient } from "../_shared/client.ts";
import { sendTemplateMessage } from "./send-message.ts";
import { PARALLEL_SEND_MESSAGE_COUNT } from "../_shared/constants.ts";
import { Template } from "../setup/message_template.ts";
import { runInBackground } from "../_shared/background.ts";
import { ContactLike, TemplateParameters, buildTemplateComponents } from "../_shared/template-components.ts";

type MessageBatchReq = {
    batchId: string
    broadcast: Broadcast,
    messageTemplate: Template | null,
}

async function sendMessageAndUpdateMessageId(supabase: SupabaseClientType, broadcast: Broadcast, contact: BroadcastContact, messageTemplate: Template | null, components: unknown[]) {
    console.log(`BroadcastId: ${broadcast.id} - Sending message to ${contact.contact_id}`)
    try {
        const { payload, response: responseData } = await sendTemplateMessage(broadcast.template_name, broadcast.language, contact.contact_id.toString(), components)
        if (responseData.messages.length > 0) {
            const message_id = responseData.messages[0].id

            const { error: errorUpdateBroadcastContact } = await supabase
                .from('broadcast_contact')
                .update({ processed_at: new Date(), wam_id: message_id })
                .eq('id', contact.id)
            if (errorUpdateBroadcastContact) throw errorUpdateBroadcastContact
            // deno-lint-ignore no-explicit-any
            const msgToPut: any = structuredClone(payload)
            delete msgToPut.messaging_product;
            delete msgToPut.recipient_type;
            msgToPut['id'] = message_id
            if (messageTemplate) msgToPut['template'] = messageTemplate
            const { error: errorMessageInsert } = await supabase
                .from('messages')
                .insert({
                    message: msgToPut,
                    wam_id: message_id,
                    chat_id: Number.parseInt(responseData.contacts[0].wa_id),
                })
            if (errorMessageInsert) throw errorMessageInsert

            //TODO: Update sent_count in broadcast table
        } else {
            console.warn(`BroadcastId: ${broadcast.id} - Send message to ${contact.contact_id} - responseData.messages.length`)
        }
        console.log(`BroadcastId: ${broadcast.id} - Send message done to ${contact.contact_id}`)
        return true
    } catch(e) {
        console.error("Error whie sending message or updating status", e)
        return false
    }
}

async function sendMessages(supabase: SupabaseClientType, broadcast: Broadcast, batchId: string, messageTemplate: Template | null) {
    const { data: contacts, error } = await supabase
        .from('broadcast_contact')
        .select('*')
        .eq('batch_id', batchId)
        .is('processed_at', null)
        .order('created_at', { ascending: true })
    if (error) throw error
    console.log(`BroadcastId: ${broadcast.id} - BatchId: ${batchId} - Send batch messages started`)

    // Load contact details once for per-recipient variable resolution.
    const templateParameters: TemplateParameters | null = (broadcast.template_parameters as TemplateParameters | null) ?? null
    const contactById = new Map<string, ContactLike>()
    if (templateParameters && templateParameters.bindings?.some((b) => b.kind === "field")) {
        const contactIds = Array.from(new Set(contacts.map((c) => c.contact_id)))
        if (contactIds.length > 0) {
            const { data: contactRows, error: contactErr } = await supabase
                .from('contacts')
                .select('wa_id, profile_name')
                .in('wa_id', contactIds)
            if (contactErr) throw contactErr
            for (const c of contactRows ?? []) contactById.set(c.wa_id.toString(), c)
        }
    }

    let contactsGroup: BroadcastContact[] = []
    for (const [idx, contact] of contacts.entries()) {
        if (contactsGroup.length < PARALLEL_SEND_MESSAGE_COUNT) {
            contactsGroup.push(contact)
        }
        if (contactsGroup.length >= PARALLEL_SEND_MESSAGE_COUNT || idx == contacts.length - 1) {
            console.log(`Sending messages parallelly to: ${contactsGroup.map(c => c.contact_id)}`)
            const contactSendPromises = []
            for (const contactToSend of contactsGroup) {
                const contactData: ContactLike = contactById.get(contactToSend.contact_id.toString())
                    ?? { wa_id: contactToSend.contact_id, profile_name: null }
                const components = buildTemplateComponents(templateParameters, contactData)
                contactSendPromises.push(sendMessageAndUpdateMessageId(supabase, broadcast, contactToSend, messageTemplate, components))
            }
            const results = await Promise.all(contactSendPromises)
            const argsToUpdateCount = {
                processed_count_to_be_added: results.filter(r => r).length,
                b_id: broadcast.id
            }
            const { error: countUpdateError } = await supabase.rpc('add_processed_count_to_broadcast', argsToUpdateCount)
            if (countUpdateError) {
                console.error(`Error while updating count for broadcast: ${broadcast.id}, ${argsToUpdateCount.processed_count_to_be_added}`, countUpdateError)
            }
            contactsGroup = []
        }
    }
    console.log(`BroadcastId: ${broadcast.id} - BatchId: ${batchId} - Send batch messages completed`)
}

async function startBatch(supabase: SupabaseClientType, broadcast: Broadcast, batchId: string, messageTemplate: Template | null) {
    const { error: errorStartBatch } = await supabase
        .from('broadcast_batch')
        .update({ started_at: new Date() })
        .eq('id', batchId)
    if (errorStartBatch) throw errorStartBatch
    await sendMessages(supabase, broadcast, batchId, messageTemplate)
    const { error: errorEndBatch } = await supabase
        .from('broadcast_batch')
        .update({ ended_at: new Date(), status: "COMPLETED" })
        .eq('id', batchId)
    if (errorEndBatch) throw errorEndBatch
}

async function startNextBatch(supabase: SupabaseClientType, broadcast: Broadcast, messageTemplate: Template | null): Promise<boolean> {
    const { data: batchId, error } = await supabase.rpc('pick_next_broadcast_batch', {
        b_id: broadcast.id
    })
    if (error) throw error
    console.log('batchId', batchId)
    if (!batchId) return false
    try {
        await startBatch(supabase, broadcast, batchId, messageTemplate)
    } catch (e) {
        // The batch was atomically claimed (status='PICKED') by the RPC. If processing
        // fails we must not leave it stranded — mark it FAILED so it is not re-picked
        // (avoiding an infinite retry loop) while letting the drain continue to the
        // remaining batches.
        console.error(`BroadcastId: ${broadcast.id} - BatchId: ${batchId} - batch failed, marking FAILED`, e)
        await supabase
            .from('broadcast_batch')
            .update({ status: 'FAILED', ended_at: new Date() })
            .eq('id', batchId)
    }
    // Return true regardless so the worker continues draining subsequent batches.
    return true;
}

async function processNextBatch(supabase: SupabaseClientType, messageBatchReq: MessageBatchReq) {
    try {
        const success = await startNextBatch(supabase, messageBatchReq.broadcast, messageBatchReq.messageTemplate)
        if (success) {
            // More batches may remain — hand off to a fresh worker so this one can finish.
            await supabase.functions.invoke('send-message-batch', {
                body: {
                    broadcast: messageBatchReq.broadcast,
                    messageTemplate: messageBatchReq.messageTemplate
                }
            })
        }
    } catch (e) {
        console.error('processNextBatch failed', e)
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const authorizationHeader = req.headers.get('Authorization')!
    const supabase = createSupabaseClient(authorizationHeader)

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return new Response('', { status: 401, headers: corsHeaders })
    }
    const messageBatchReq: MessageBatchReq = await req.json()

    // Process the batch in the background so the caller (and the recursive
    // hand-off) returns immediately instead of holding the connection open.
    runInBackground(processNextBatch(supabase, messageBatchReq))

    return new Response(
        JSON.stringify({ success: true }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
})
