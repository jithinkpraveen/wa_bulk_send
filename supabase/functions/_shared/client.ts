import { createClient } from 'supabase-js'
import { Database } from "./database.types.ts";

// Runs as the authenticated user (forwards their JWT) — subject to RLS.
export function createSupabaseClient(authorizationHeader: string) {
    return createClient<Database>(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { global: { headers: { Authorization: authorizationHeader } } }
    )
}

// Runs as the service role — BYPASSES RLS. Use for admin/bulk operations
// (contacts/broadcast writes are admin-only under the app's RLS) AFTER verifying
// the caller is authenticated via getBearerToken + auth.getUser(token).
export function createServiceRoleClient() {
    return createClient<Database>(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
}

export function getBearerToken(authorizationHeader: string | null): string {
    return (authorizationHeader ?? '').replace(/^Bearer\s+/i, '')
}

export type SupabaseClientType = ReturnType<typeof createSupabaseClient>
