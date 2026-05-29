'use server';

import { createClient as createServerClient } from '@/utils/supabase-server';
import { createServiceClient } from '@/lib/supabase/service-client';

// Contact writes go through the service-role client (bypassing RLS) because the
// remote contacts policies are role-based (admin/agent via JWT claims) and would
// otherwise silently drop updates for users without that claim. Each action is
// gated on an authenticated session.
async function requireUser() {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

function cleanTags(tags: string[]): string[] {
    return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
}

async function ensureTags(svc: ReturnType<typeof createServiceClient>, tags: string[]): Promise<string | null> {
    if (tags.length === 0) return null;
    const { error } = await svc
        .from('contact_tag')
        .upsert(tags.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
    return error ? error.message : null;
}

export async function saveContactTags(waId: number, tags: string[]): Promise<{ error?: string }> {
    const user = await requireUser();
    if (!user) return { error: 'Not authenticated' };

    const clean = cleanTags(tags);
    const svc = createServiceClient();

    const tagErr = await ensureTags(svc, clean);
    if (tagErr) return { error: tagErr };

    const { error } = await svc
        .from('contacts')
        .update({ tags: clean.length > 0 ? clean : null })
        .eq('wa_id', waId);
    if (error) return { error: error.message };
    return {};
}

export async function createContactWithTags(input: {
    waId: number;
    name: string;
    tags: string[];
}): Promise<{ error?: string }> {
    const user = await requireUser();
    if (!user) return { error: 'Not authenticated' };

    const clean = cleanTags(input.tags);
    const svc = createServiceClient();

    const tagErr = await ensureTags(svc, clean);
    if (tagErr) return { error: tagErr };

    const { error } = await svc
        .from('contacts')
        .insert({ wa_id: input.waId, profile_name: input.name, tags: clean.length > 0 ? clean : null });
    if (error) return { error: error.message };
    return {};
}
