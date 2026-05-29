import Link from "next/link";
import { Contact } from "@/types/contact";
import BlankUser from "./BlankUser";
import { UPDATE_CURRENT_CONTACT, useCurrentContactDispatch } from "./CurrentContactContext";

export default function ContactUI(props: { contact: Contact }) {
    const { contact } = props;
    const setCurrentContact = useCurrentContactDispatch()
    const displayName = contact.profile_name || contact.wa_id.toString()
    return (
        <Link href={`/chats/${contact.wa_id}`} onClick={() => { setCurrentContact && setCurrentContact({ type: UPDATE_CURRENT_CONTACT, waId: contact.wa_id }) }}>
            <div className="flex flex-row items-center px-4 py-3 hover:bg-background-default-hover gap-3 cursor-pointer border-b border-gray-100">
                <BlankUser className="w-12 h-12 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-primary-strong truncate">{displayName}</div>
                    <div className="text-sm text-gray-500 truncate">{contact.wa_id}</div>
                </div>
            </div>
        </Link>
    )
}