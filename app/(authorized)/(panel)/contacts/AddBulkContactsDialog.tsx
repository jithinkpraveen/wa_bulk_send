import TWLoader from "@/components/TWLoader"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import {
    Form,
    FormControl, FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase-browser"
import { zodResolver } from "@hookform/resolvers/zod"
import { ReactNode, useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"

const FormSchema = z.object({
    bulkfile: typeof window === 'undefined' ? z.any() : z.instanceof(FileList).refine((file) => file?.length == 1, 'File is required.')
});

export function AddBulkContactsDialog({ children, onSuccessfulAdd }: { children: ReactNode, onSuccessfulAdd: () => void }) {
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [supabase] = useState(() => createClient())
    const [isLoading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [tagsInput, setTagsInput] = useState<string>('');
    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        /*defaultValues: {
            file: "",
        }*/
    })

    const fileRef = form.register("bulkfile");

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        setLoading(true)
        setErrorMessage('')
        try {
            const bulkfile = data.bulkfile?.[0]
            if (!bulkfile) {
                setErrorMessage('Please choose a CSV file.')
                return
            }
            const csvData = await bulkfile.text()
            const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
            const res = await supabase.functions.invoke("insert-bulk-contacts", {
                body: { csvData, tags },
            });
            if (res.error) {
                console.error('Error while sending bulk csv', res.error)
                let message = 'Something went wrong'
                // FunctionsHttpError exposes the failed Response via `context`; read the error our function returned.
                try {
                    const body = await (res.error as any)?.context?.json?.()
                    if (body?.error) message = body.error
                } catch (_) { /* keep generic message */ }
                setErrorMessage(message)
                return;
            }
            form.reset()
            setTagsInput('')
            setDialogOpen(false)
            onSuccessfulAdd()
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Bulk Contacts via CSV</DialogTitle>
                    <DialogDescription>
                        Upload CSV file containing contacts to add. <a className="text-blue-500" href="/assets/example-bulk-contacts.csv" target="_blank" rel="noopener noreferrer">Click here</a> to download sample CSV file.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="bulkfile"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>CSV file</FormLabel>
                                    <FormControl>
                                        <Input type="file" {...fileRef} accept="text/csv" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Tag for all imported contacts (optional)</label>
                            <Input
                                placeholder="e.g. lead"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">Applied to every contact in the file, in addition to the CSV&apos;s tags column.</span>
                        </div>
                        {(() => {
                            if (errorMessage) {
                                return (
                                    <span className="text-red-500 text-sm">{errorMessage}</span>
                                )
                            }
                        })()}
                        <DialogFooter>
                            {isLoading && <TWLoader className="w-10 h-10"/>}
                            {!isLoading && <Button type="submit">Submit</Button>}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
