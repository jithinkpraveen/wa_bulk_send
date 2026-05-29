import { getBroadcastById, getBroadcastRecipients } from "@/lib/bulk-send/broadcast-detail"
import { notFound } from "next/navigation"
import BroadcastDetailClient from "./BroadcastDetailClient"

export default async function BroadcastDetailPage({ params }: { params: { id: string } }) {
    const broadcast = await getBroadcastById(params.id)
    if (!broadcast) notFound()
    const initial = await getBroadcastRecipients(params.id, 'all', 1)
    return (
        <BroadcastDetailClient
            broadcast={broadcast}
            initialRecipients={initial.rows}
            initialTotal={initial.total}
        />
    )
}
