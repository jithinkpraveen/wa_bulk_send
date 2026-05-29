import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import ContactTagServerFactory from "@/lib/repositories/contact-tag/ContactTagServerFactory"
import MessageTemplateServerFactory from "@/lib/repositories/message-template/MessageTemplateServerFactory"
import AudienceSelector from "./AudienceSelector"
import MessageTemplateWithLanguage from "./MessageTemplateWithLanguage"
import NewBroadcastPageForm from "./NewBroadcastPageForm"
import RefreshTemplatesButton from "./RefreshTemplatesButton"
import { SubmitButton } from "./SubmitButton"

function convertToOptions(value: string) {
    return {
        value: value,
        label: value,
    }
}

export default async function NewBroadcastPage() {
    const messageTemplateRepo = MessageTemplateServerFactory.getInstance()
    const contactTagRepo = ContactTagServerFactory.getInstance()
    const messageTemplates = (await messageTemplateRepo.getMessageTemplateUniqueNames()).map(convertToOptions)
    const contactTags = (await contactTagRepo.getContactTags()).map(convertToOptions)
    return (
        <div className="max-w-2xl space-y-6">
            <div className="pt-2 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">New Broadcast</h1>
                    <p className="text-sm text-muted-foreground">Choose a template and audience, fill any variables, then send.</p>
                </div>
                <RefreshTemplatesButton />
            </div>
            {messageTemplates.length === 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                    No message templates found. Make sure your WhatsApp credentials are set and you have
                    approved templates in Meta, then click <span className="font-medium">Refresh templates</span>.
                </div>
            )}
            <NewBroadcastPageForm>
                <div className="grid gap-1.5">
                    <Label htmlFor="broadcast_name">Name</Label>
                    <Input className="w-[20rem]" name="broadcast_name" />
                </div>
                <MessageTemplateWithLanguage messageTemplates={messageTemplates} />
                <AudienceSelector tagOptions={contactTags} />
                <SubmitButton/>
            </NewBroadcastPageForm>
        </div>
    )
}