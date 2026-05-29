import { MessageCircle } from "lucide-react"

export default function Chats() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
            <MessageCircle className="h-12 w-12 opacity-30" />
            <p>Select a conversation to start messaging</p>
        </div>
    )
}
