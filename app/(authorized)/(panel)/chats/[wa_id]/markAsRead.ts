'use server';

import { DBTables } from "@/lib/enums/Tables";
import { createServiceClient } from "@/lib/supabase/service-client";

// Clears a contact's unread badge when its chat is opened. Uses the service role
// (contacts writes are admin-only under the remote RLS); the resulting UPDATE
// broadcasts over realtime so the sidebar badge clears live.
export async function markChatAsRead(waId: number) {
    const supabase = createServiceClient();
    const { error } = await supabase
        .from(DBTables.Contacts)
        .update({ unread_count: 0 })
        .eq('wa_id', waId);
    if (error) throw error;
}
