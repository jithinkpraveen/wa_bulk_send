'use server';

import { createClient as createServerClient } from '@/utils/supabase-server';
import { BroadcastFromDB } from '@/lib/repositories/broadcast/BroadcastRepository';

export type RecipientStatus = 'replied' | 'read' | 'delivered' | 'sent' | 'pending';
export type RecipientFilter = 'all' | 'sent' | 'delivered' | 'read' | 'replied';

export type BroadcastRecipient = {
    id: string;
    contact_id: number;
    name: string | null;
    status: RecipientStatus;
    sent_at: string | null;
    delivered_at: string | null;
    read_at: string | null;
    replied_at: string | null;
};

export type BroadcastReply = {
    contact_id: number;
    name: string | null;
    replied_at: string | null;
    messages: { text: string; at: string }[];
};

const RECIPIENTS_PAGE_SIZE = 25;

function deriveStatus(r: {
    reply_counted: boolean;
    read_at: string | null;
    delivered_at: string | null;
    sent_at: string | null;
}): RecipientStatus {
    if (r.reply_counted) return 'replied';
    if (r.read_at) return 'read';
    if (r.delivered_at) return 'delivered';
    if (r.sent_at) return 'sent';
    return 'pending';
}

// Inbound (reply) messages carry a `from`; our outbound sends carry `to`/`template`.
function isInbound(message: any): boolean {
    return !!(message && typeof message === 'object' && message.from && !message.template);
}

function messageText(message: any): string {
    if (!message || typeof message !== 'object') return '';
    if (message.type === 'text') return message.text?.body ?? '';
    if (message.type === 'button') return message.button?.text ?? '[button]';
    if (message.type === 'interactive') {
        return message.interactive?.button_reply?.title
            ?? message.interactive?.list_reply?.title
            ?? '[interactive]';
    }
    if (message.type) return `[${message.type}]`;
    return '';
}

async function fetchNames(supabase: ReturnType<typeof createServerClient>, ids: number[]) {
    const map = new Map<string, string | null>();
    if (ids.length === 0) return map;
    const { data } = await supabase.from('contacts').select('wa_id, profile_name').in('wa_id', ids);
    for (const c of data ?? []) map.set(c.wa_id.toString(), c.profile_name);
    return map;
}

export async function getBroadcastById(id: string): Promise<BroadcastFromDB | null> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from('broadcast').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getBroadcastRecipients(
    id: string,
    filter: RecipientFilter,
    page: number,
): Promise<{ rows: BroadcastRecipient[]; total: number }> {
    const supabase = createServerClient();
    const from = (page - 1) * RECIPIENTS_PAGE_SIZE;
    const to = from + RECIPIENTS_PAGE_SIZE - 1;

    let query = supabase
        .from('broadcast_contact')
        .select('id, contact_id, sent_at, delivered_at, read_at, replied_at, reply_counted', { count: 'exact' })
        .eq('broadcast_id', id);

    if (filter === 'replied') query = query.eq('reply_counted', true);
    else if (filter === 'read') query = query.not('read_at', 'is', null);
    else if (filter === 'delivered') query = query.not('delivered_at', 'is', null);
    else if (filter === 'sent') query = query.not('sent_at', 'is', null);

    const { data, error, count } = await query.order('created_at', { ascending: true }).range(from, to);
    if (error) throw error;

    const names = await fetchNames(supabase, (data ?? []).map((r) => r.contact_id));
    const rows: BroadcastRecipient[] = (data ?? []).map((r) => ({
        id: r.id,
        contact_id: r.contact_id,
        name: names.get(r.contact_id.toString()) ?? null,
        status: deriveStatus(r),
        sent_at: r.sent_at,
        delivered_at: r.delivered_at,
        read_at: r.read_at,
        replied_at: r.replied_at,
    }));
    return { rows, total: count ?? rows.length };
}

export async function getBroadcastReplies(id: string): Promise<BroadcastReply[]> {
    const supabase = createServerClient();
    const { data: replied, error } = await supabase
        .from('broadcast_contact')
        .select('contact_id, replied_at, processed_at')
        .eq('broadcast_id', id)
        .eq('reply_counted', true);
    if (error) throw error;
    if (!replied || replied.length === 0) return [];

    const ids = replied.map((r) => r.contact_id);
    const names = await fetchNames(supabase, ids);

    // Earliest send time across the replied recipients — replies must be after this.
    const earliest = replied
        .map((r) => r.processed_at)
        .filter((t): t is string => !!t)
        .sort()[0];

    let msgQuery = supabase
        .from('messages')
        .select('chat_id, message, created_at')
        .in('chat_id', ids)
        .order('created_at', { ascending: true });
    if (earliest) msgQuery = msgQuery.gte('created_at', earliest);
    const { data: messages, error: msgError } = await msgQuery;
    if (msgError) throw msgError;

    const byContact = new Map<string, { text: string; at: string }[]>();
    for (const m of messages ?? []) {
        if (!isInbound(m.message)) continue;
        const key = m.chat_id.toString();
        const list = byContact.get(key) ?? [];
        list.push({ text: messageText(m.message), at: m.created_at });
        byContact.set(key, list);
    }

    return replied.map((r) => ({
        contact_id: r.contact_id,
        name: names.get(r.contact_id.toString()) ?? null,
        replied_at: r.replied_at,
        messages: byContact.get(r.contact_id.toString()) ?? [],
    }));
}
