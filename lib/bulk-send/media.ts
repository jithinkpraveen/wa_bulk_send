'use server';

import { createClient as createServerClient } from '@/utils/supabase-server';
import { createServiceClient } from '@/lib/supabase/service-client';

const BUCKET = 'template-media';

// Uploads a header media file to a public Storage bucket and returns its public
// URL, which the send flow uses as the template header's media `link`. Runs with
// the service role (gated on an authenticated session) to avoid Storage RLS.
export async function uploadTemplateMedia(formData: FormData): Promise<{ url?: string; error?: string }> {
    const auth = createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { error: 'No file selected' };

    const svc = createServiceClient();
    // Ensure the public bucket exists (idempotent — ignores "already exists").
    await svc.storage.createBucket(BUCKET, { public: true });

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await svc.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) return { error: error.message };

    const { data } = svc.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl };
}
