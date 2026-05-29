'use client';

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase-browser";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Re-downloads message templates from the WhatsApp Business account (the `setup`
// edge function runs the template sync) and refreshes the page so the dropdown
// reflects the latest templates.
export default function RefreshTemplatesButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function onClick() {
        setLoading(true);
        setError('');
        try {
            const supabase = createClient();
            const { data, error } = await supabase.functions.invoke('setup');
            // The function returns 200 with { success, error } even on failure, so
            // inspect the body — not just the transport-level error.
            if (error || !data?.success) {
                console.error('refresh templates failed', error ?? data);
                setError(
                    data?.error ||
                    'Could not refresh templates. Check that WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_ACCESS_TOKEN are set and that you have approved templates.'
                );
                return;
            }
            router.refresh();
        } catch (e) {
            console.error('refresh templates failed', e);
            setError('Could not refresh templates. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing…' : 'Refresh templates'}
            </Button>
            {error && <span className="text-xs text-red-500 max-w-[14rem] text-right">{error}</span>}
        </div>
    );
}
