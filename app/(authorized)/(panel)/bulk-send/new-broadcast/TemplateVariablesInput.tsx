'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    CONTACT_FIELD_OPTIONS,
    ContactField,
    ParamBinding,
    TemplateParameters,
} from "@/lib/bulk-send/template-parameters";

type Source = "static" | `field:${ContactField}`;

function sourceOf(b: ParamBinding): Source {
    return b.kind === "field" && b.field ? (`field:${b.field}` as Source) : "static";
}

export default function TemplateVariablesInput({
    parameters,
    onChange,
}: {
    parameters: TemplateParameters;
    onChange: (next: TemplateParameters) => void;
}) {
    if (parameters.bindings.length === 0) return null;

    function update(ref: string, patch: Partial<ParamBinding>) {
        onChange({
            ...parameters,
            bindings: parameters.bindings.map((b) => (b.ref === ref ? { ...b, ...patch } : b)),
        });
    }

    function onSourceChange(b: ParamBinding, source: Source) {
        if (source === "static") {
            update(b.ref, { kind: "static", field: undefined });
        } else {
            const field = source.split(":")[1] as ContactField;
            update(b.ref, { kind: "field", field });
        }
    }

    return (
        <div className="grid gap-3 rounded-md border p-4">
            <p className="text-sm font-medium">Template variables</p>
            {parameters.bindings.map((b) => (
                <div key={b.ref} className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">{b.label}</Label>
                    {b.kind === "media" ? (
                        <Input
                            type="url"
                            placeholder="https://example.com/file"
                            value={b.value}
                            onChange={(e) => update(b.ref, { value: e.target.value })}
                            className="w-[20rem]"
                        />
                    ) : b.component === "button" ? (
                        <Input
                            placeholder="URL suffix"
                            value={b.value}
                            onChange={(e) => update(b.ref, { value: e.target.value })}
                            className="w-[20rem]"
                        />
                    ) : (
                        <div className="flex gap-2">
                            <select
                                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                                value={sourceOf(b)}
                                onChange={(e) => onSourceChange(b, e.target.value as Source)}
                            >
                                <option value="static">Static text</option>
                                {CONTACT_FIELD_OPTIONS.map((f) => (
                                    <option key={f.value} value={`field:${f.value}`}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                            <Input
                                placeholder={
                                    b.kind === "field" ? "Fallback if empty (optional)" : "Value"
                                }
                                value={b.value}
                                onChange={(e) => update(b.ref, { value: e.target.value })}
                                className="flex-1"
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
