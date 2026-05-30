'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Contact } from "@/types/contact";
import BlankUser from "./BlankUser";
import { UPDATE_CURRENT_CONTACT, useCurrentContactDispatch } from "./CurrentContactContext";

function fmtTime(ts: string | null): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ContactUI(props: { contact: Contact }) {
    const { contact } = props;
    const setCurrentContact = useCurrentContactDispatch()
    const pathname = usePathname()
    const active = pathname === `/chats/${contact.wa_id}`
    const unread = contact.unread_count ?? 0
    const displayName = contact.profile_name || contact.wa_id.toString()
    return (
        <Link href={`/chats/${contact.wa_id}`} onClick={() => { setCurrentContact && setCurrentContact({ type: UPDATE_CURRENT_CONTACT, waId: contact.wa_id }) }}>
            <div className={`flex flex-row items-center px-4 py-3 gap-3 cursor-pointer border-b border-gray-100 ${active ? 'bg-background-default-hover' : 'hover:bg-background-default-hover'}`}>
                <BlankUser className="w-12 h-12 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className={`truncate text-primary-strong ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{displayName}</div>
                    <div className="text-sm text-gray-500 truncate">{contact.wa_id}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    {contact.last_message_at && (
                        <span suppressHydrationWarning className={`text-xs ${unread > 0 ? 'text-[#25d366]' : 'text-gray-400'}`}>
                            {fmtTime(contact.last_message_at)}
                        </span>
                    )}
                    {unread > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#25d366] text-white text-xs font-medium">
                            {unread}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}
