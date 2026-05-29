'use client'

import ChatContactsClient from "./ChatContactsClient";
import { useContacts } from "./CurrentContactContext";

export const revalidate = 0

export default function ChatContacts() {
    const contactState = useContacts();
    return (
        <div className="flex flex-col h-full">
            <div className="h-16 flex items-center px-4 border-b bg-panel-header-background">
                <h2 className="font-semibold text-primary-strong">Chats</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
                {contactState
                    ? <ChatContactsClient contacts={contactState.contacts} />
                    : <div className="p-4 text-sm text-muted-foreground">Unable to fetch contacts</div>}
            </div>
        </div>
    )
}
