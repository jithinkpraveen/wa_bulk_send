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
import { createContactWithTags } from "@/lib/contacts/actions"
import { zodResolver } from "@hookform/resolvers/zod"
import { ReactNode, useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { CountryDropdown, countryFormType } from "./CountryDropdown"

const FormSchema = z.object({
    name: z.string({
        required_error: "Name is required",
    }).min(3),
    wa_number: z.string({
        required_error: "Mobile number is required",
    }).min(7),
    country: countryFormType,
    tags: z.string().optional(),
})

export function AddContactDialog({ children, onSuccessfulAdd }: { children: ReactNode, onSuccessfulAdd: () => void }) {
    const [ isDialogOpen, setDialogOpen] = useState(false);
    const [ errorMessage, setErrorMessage ] = useState('');
    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            name: "",
            wa_number: "",
            country: undefined,
            tags: "",
        }
    })

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        setErrorMessage('')
        const mobileNumber = data.country.phoneCode.replace(/[\+\-]/, '') + data.wa_number
        const wa_id = Number.parseInt(mobileNumber)
        const tags = (data.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean)
        const res = await createContactWithTags({ waId: wa_id, name: data.name, tags })
        if (res?.error) {
            setErrorMessage(res.error)
            return
        }
        form.reset()
        setDialogOpen(false)
        onSuccessfulAdd()
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                    <DialogDescription>
                        Enter mobile number and name of the contact
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex flex-row gap-2">
                            <FormField
                                control={form.control}
                                name="country"
                                render={({ field }) => (
                                    <CountryDropdown {...field} />
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="wa_number"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Whatsapp Number</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="tags"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Tags (comma separated)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="vip, lead" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {errorMessage && <span className="text-sm text-red-500">{errorMessage}</span>}
                        <DialogFooter>
                            <Button type="submit">Add</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
