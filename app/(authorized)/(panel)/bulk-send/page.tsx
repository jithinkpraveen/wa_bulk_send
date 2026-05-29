import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import BroadcastServerFactory from "@/lib/repositories/broadcast/BroadcastServerFactory"
import Link from "next/link"
import PaginationButton from "./PaginationButton"
import WatchForChanges from "./WatchForChanges"

export default async function BulkSendPage({
    params,
    searchParams,
}: {
    params: { slug: string }
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const pageString = searchParams['page']
    let page = 1;
    if (pageString && typeof pageString === 'string') {
        const parsedPage = parseInt(pageString)
        if (!isNaN(page)) {
            page = parsedPage;
        }
    }

    const broadcastServer = BroadcastServerFactory.getInstance()
    const broadcasts = await broadcastServer.getAllBroadcasts(page)

    return (
        <>
            <WatchForChanges page={page} />
            <div className="space-y-4">
                <div className="flex items-center justify-between pt-2">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Bulk Send</h1>
                        <p className="text-sm text-muted-foreground">Send WhatsApp templates to your tagged contacts.</p>
                    </div>
                    <Link href="/bulk-send/new-broadcast"><Button>New Broadcast</Button></Link>
                </div>
                <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Name</TableHead>
                            <TableHead>Template</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Sent</TableHead>
                            <TableHead className="text-right">Delivered</TableHead>
                            <TableHead className="text-right">Read</TableHead>
                            <TableHead className="text-right">Replied</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {broadcasts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    No broadcasts yet. Create your first one with “New Broadcast”.
                                </TableCell>
                            </TableRow>
                        )}
                        {broadcasts.map((broadcast) => (
                            <TableRow key={broadcast.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/bulk-send/${broadcast.id}`} className="text-primary hover:underline">
                                        {broadcast.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{broadcast.template_name} - {broadcast.language}</TableCell>
                                <TableCell>{broadcast.contact_tags?.join(', ')}</TableCell>
                                <TableCell>{broadcast.created_at}</TableCell>
                                <TableCell className="text-right">{broadcast.sent_count}</TableCell>
                                <TableCell className="text-right">{broadcast.delivered_count}</TableCell>
                                <TableCell className="text-right">{broadcast.read_count}</TableCell>
                                <TableCell className="text-right">{broadcast.replied_count}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
                <div className="text-right space-x-2">
                    <PaginationButton pagesToAdd={-1}>Previous</PaginationButton>
                    <PaginationButton pagesToAdd={1}>Next</PaginationButton>
                </div>
            </div>
        </>
    )
}
