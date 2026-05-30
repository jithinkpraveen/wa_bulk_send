'use client'

import { useEffect, useState } from "react";
import { DBTables } from "@/lib/enums/Tables";
import { Contact } from "@/types/contact";
import { createClient } from "@/utils/supabase-browser";
import ContactUI from "./ContactUI";

function byRecency(a: Contact, b: Contact): number {
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return bt - at // newest first
}

export default function ChatContactsClient({ contacts }: { contacts: Contact[] }) {
    const [supabase] = useState(() => createClient())
    const [contactsState, setContacts] = useState<Contact[]>(() => [...contacts].sort(byRecency))

    useEffect(() => {
        const channel = supabase
            .channel('contacts-changes')
            .on<Contact>('postgres_changes', { event: '*', schema: 'public', table: DBTables.Contacts }, payload => {
                setContacts(prev => {
                    switch (payload.eventType) {
                        case "INSERT": {
                            const c = payload.new as Contact
                            return [c, ...prev.filter(p => p.wa_id !== c.wa_id)].sort(byRecency)
                        }
                        case "UPDATE": {
                            const updated = payload.new as Contact
                            const exists = prev.some(p => p.wa_id === updated.wa_id)
                            const next = exists
                                ? prev.map(p => (p.wa_id === updated.wa_id ? updated : p))
                                : [updated, ...prev] // became active (in_chat) — surface it
                            return next.sort(byRecency)
                        }
                        case "DELETE":
                            return prev.filter(p => p.wa_id !== (payload.old as Contact).wa_id)
                        default:
                            return prev
                    }
                })
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [supabase])

    if (!contactsState || contactsState.length === 0) {
        return <div className="p-4 text-sm text-muted-foreground">No conversations yet</div>
    }
    return (
        <div className="flex flex-col">
            {contactsState.map(contact => (
                <ContactUI key={contact.wa_id} contact={contact} />
            ))}
        </div>
    )
}
