'use client'

import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Contact } from "@/types/contact"
import { createClient } from "@/utils/supabase-browser"
import { MoreHorizontal } from "lucide-react"
import { useState } from "react"

function parseTags(input: string): string[] {
    return Array.from(new Set(input.split(',').map((t) => t.trim()).filter(Boolean)))
}

export default function ContactRowActions({ contact, onUpdated }: { contact: Contact, onUpdated: () => void }) {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState((contact.tags ?? []).join(', '))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    async function save() {
        setSaving(true)
        setError('')
        try {
            const tags = parseTags(value)
            const supabase = createClient()
            if (tags.length > 0) {
                const { error: tagErr } = await supabase
                    .from('contact_tag')
                    .upsert(tags.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
                if (tagErr) { setError('Could not save tags'); return }
            }
            const { error: updErr } = await supabase
                .from('contacts')
                .update({ tags: tags.length > 0 ? tags : null })
                .eq('wa_id', contact.wa_id)
            if (updErr) { setError('Could not update contact'); return }
            setOpen(false)
            onUpdated()
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit tags</DropdownMenuItem>
                    </DialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit tags</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input id="tags" value={value} onChange={(e) => setValue(e.target.value)} placeholder="vip, lead" />
                    {error && <span className="text-sm text-red-500">{error}</span>}
                </div>
                <DialogFooter>
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
