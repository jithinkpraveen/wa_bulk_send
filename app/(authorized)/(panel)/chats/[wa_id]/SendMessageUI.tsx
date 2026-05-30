'use client';

import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

type SendMessageUIProps = {
    onMessageSend: (message: string) => void,
    message: string,
    setMessage: Dispatch<SetStateAction<string>>
}

export default function SendMessageUI({ message, setMessage, onMessageSend }: SendMessageUIProps) {
    return (
        <form className="bg-rich-text-panel-background px-4 py-3 flex flex-row gap-3 items-center" onSubmit={(event) => {
            event.preventDefault()
            if (message.trim()) onMessageSend(message)
        }}>
            <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full px-4 py-2 rounded-full bg-white outline-none focus:ring-2 focus:ring-[#25d366]/40"
                placeholder="Type a message"
            />
            <Button type="submit" aria-label="Send" className="rounded-full shrink-0 h-10 w-10 p-0">
                <Send className="h-4 w-4" />
            </Button>
        </form>
    )
}
