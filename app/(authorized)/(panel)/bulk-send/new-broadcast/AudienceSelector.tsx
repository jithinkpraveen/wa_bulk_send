'use client';

import { Label } from "@/components/ui/label";
import { useState } from "react";
import { MultiSelectDropdown, Option } from "./MultiSelectDropdown";

// Audience for a broadcast: either existing contact tags, or a CSV of contacts
// that get auto-tagged with the broadcast name and messaged. Only the active
// mode's input is mounted, so only it is submitted with the form.
export default function AudienceSelector({ tagOptions }: { tagOptions: Option[] }) {
    const [mode, setMode] = useState<'tags' | 'csv'>('tags');
    return (
        <div className="grid gap-2">
            <Label>Audience</Label>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setMode('tags')}
                    className={`rounded-md border px-3 py-1.5 text-sm ${mode === 'tags' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                >
                    Existing tags
                </button>
                <button
                    type="button"
                    onClick={() => setMode('csv')}
                    className={`rounded-md border px-3 py-1.5 text-sm ${mode === 'csv' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                >
                    Upload CSV
                </button>
            </div>
            {mode === 'tags' ? (
                <MultiSelectDropdown name="contact_tags" displayName="tag" className="w-[20rem]" options={tagOptions} />
            ) : (
                <div className="grid gap-1.5">
                    <input
                        type="file"
                        name="csv_file"
                        accept="text/csv"
                        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                        CSV columns: name, number, tags. Everyone in the file is tagged with the broadcast name and messaged.
                    </p>
                </div>
            )}
        </div>
    );
}
