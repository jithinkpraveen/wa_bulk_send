'use client'

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import ChatContactsClient from "./ChatContactsClient";
import { useContacts } from "./CurrentContactContext";

export const revalidate = 0

export default function ChatContacts() {
    const contactState = useContacts();
    const [search, setSearch] = useState('')
    return (
        <div className="flex flex-col h-full">
            <div className="h-16 flex items-center px-4 border-b bg-panel-header-background">
                <h2 className="font-semibold text-primary-strong">Chats</h2>
            </div>
            <div className="px-3 py-2 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or number"
                        className="pl-9 h-9 rounded-full bg-muted/50"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {contactState
                    ? <ChatContactsClient contacts={contactState.contacts} search={search} />
                    : <div className="p-4 text-sm text-muted-foreground">Unable to fetch contacts</div>}
            </div>
        </div>
    )
}
