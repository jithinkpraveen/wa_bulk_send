'use client';

import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    BroadcastRecipient,
    RecipientFilter,
    getBroadcastRecipients,
    getBroadcastReplies,
} from "@/lib/bulk-send/broadcast-detail";
import { BroadcastFromDB } from "@/lib/repositories/broadcast/BroadcastRepository";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const PAGE_SIZE = 25;

const FILTERS: { key: RecipientFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'read', label: 'Read' },
    { key: 'replied', label: 'Replied' },
];

const STATUS_STYLE: Record<string, string> = {
    replied: 'bg-primary/15 text-primary',
    read: 'bg-blue-100 text-blue-700',
    delivered: 'bg-slate-100 text-slate-700',
    sent: 'bg-amber-100 text-amber-700',
    pending: 'bg-gray-100 text-gray-500',
};

// Deterministic, timezone-independent formatting so server and client render the
// identical string (toLocaleString() varies by locale/TZ and breaks hydration).
function fmt(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function csvCell(value: string): string {
    return `"${(value ?? '').replace(/"/g, '""')}"`;
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border p-3 min-w-[6rem]">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold">{value}</div>
        </div>
    );
}

export default function BroadcastDetailClient({
    broadcast,
    initialRecipients,
    initialTotal,
}: {
    broadcast: BroadcastFromDB;
    initialRecipients: BroadcastRecipient[];
    initialTotal: number;
}) {
    const [filter, setFilter] = useState<RecipientFilter>('all');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<BroadcastRecipient[]>(initialRecipients);
    const [total, setTotal] = useState(initialTotal);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    async function load(nextFilter: RecipientFilter, nextPage: number) {
        setLoading(true);
        try {
            const { rows, total } = await getBroadcastRecipients(broadcast.id, nextFilter, nextPage);
            setRows(rows);
            setTotal(total);
            setFilter(nextFilter);
            setPage(nextPage);
        } finally {
            setLoading(false);
        }
    }

    async function exportReplies() {
        setExporting(true);
        try {
            const replies = await getBroadcastReplies(broadcast.id);
            const header = ['Number', 'Name', 'Replied At', 'Reply Messages'];
            const lines = [header.map(csvCell).join(',')];
            for (const r of replies) {
                const text = r.messages.map((m) => m.text).filter(Boolean).join(' | ');
                lines.push([
                    csvCell(r.contact_id.toString()),
                    csvCell(r.name ?? ''),
                    csvCell(fmt(r.replied_at)),
                    csvCell(text),
                ].join(','));
            }
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `replies-${broadcast.name || broadcast.id}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-5 max-w-5xl">
            <div>
                <Link href="/bulk-send" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Back to broadcasts
                </Link>
            </div>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{broadcast.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        {broadcast.template_name} · {broadcast.language} · {broadcast.contact_tags?.join(', ')}
                    </p>
                </div>
                <Button variant="outline" onClick={exportReplies} disabled={exporting} className="gap-2">
                    <Download className="h-4 w-4" />
                    {exporting ? 'Exporting…' : 'Export replies (CSV)'}
                </Button>
            </div>

            <div className="flex flex-wrap gap-3">
                <StatCard label="Scheduled" value={broadcast.scheduled_count ?? 0} />
                <StatCard label="Sent" value={broadcast.sent_count} />
                <StatCard label="Delivered" value={broadcast.delivered_count} />
                <StatCard label="Read" value={broadcast.read_count} />
                <StatCard label="Replied" value={broadcast.replied_count} />
            </div>

            <div className="flex gap-2">
                {FILTERS.map((f) => (
                    <Button
                        key={f.key}
                        size="sm"
                        variant={filter === f.key ? 'default' : 'outline'}
                        onClick={() => load(f.key, 1)}
                        disabled={loading}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Number</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sent</TableHead>
                            <TableHead>Delivered</TableHead>
                            <TableHead>Read</TableHead>
                            <TableHead>Replied</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    No recipients{filter !== 'all' ? ` with status “${filter}”` : ''}.
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell className="font-medium">{r.contact_id}</TableCell>
                                <TableCell>{r.name ?? '—'}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[r.status]}`}>
                                        {r.status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{fmt(r.sent_at)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{fmt(r.delivered_at)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{fmt(r.read_at)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{fmt(r.replied_at)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} total</span>
                <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => load(filter, page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => load(filter, page + 1)}>Next</Button>
            </div>
        </div>
    );
}
