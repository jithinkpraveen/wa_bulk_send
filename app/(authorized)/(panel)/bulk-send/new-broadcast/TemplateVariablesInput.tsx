'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadTemplateMedia } from "@/lib/bulk-send/media";
import {
    CONTACT_FIELD_OPTIONS,
    ContactField,
    ParamBinding,
    TemplateParameters,
} from "@/lib/bulk-send/template-parameters";
import { useState } from "react";

type Source = "static" | `field:${ContactField}`;

function sourceOf(b: ParamBinding): Source {
    return b.kind === "field" && b.field ? (`field:${b.field}` as Source) : "static";
}

function acceptFor(format?: string): string {
    if (format === "IMAGE") return "image/*";
    if (format === "VIDEO") return "video/*";
    if (format === "DOCUMENT") return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf";
    return "*/*";
}

export default function TemplateVariablesInput({
    parameters,
    onChange,
}: {
    parameters: TemplateParameters;
    onChange: (next: TemplateParameters) => void;
}) {
    const [uploading, setUploading] = useState<Record<string, boolean>>({});
    const [uploadError, setUploadError] = useState<Record<string, string>>({});

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

    async function onMediaFile(b: ParamBinding, file: File) {
        setUploadError((s) => ({ ...s, [b.ref]: "" }));
        setUploading((s) => ({ ...s, [b.ref]: true }));
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await uploadTemplateMedia(fd);
            if (res.error) {
                setUploadError((s) => ({ ...s, [b.ref]: res.error! }));
            } else if (res.url) {
                update(b.ref, { value: res.url });
            }
        } catch {
            setUploadError((s) => ({ ...s, [b.ref]: "Upload failed" }));
        } finally {
            setUploading((s) => ({ ...s, [b.ref]: false }));
        }
    }

    return (
        <div className="grid gap-3 rounded-md border p-4">
            <p className="text-sm font-medium">Template variables</p>
            {parameters.bindings.map((b) => (
                <div key={b.ref} className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">{b.label}</Label>
                    {b.kind === "media" ? (
                        <div className="grid gap-1">
                            <input
                                type="file"
                                accept={acceptFor(b.format)}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) onMediaFile(b, f);
                                }}
                                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground"
                            />
                            {uploading[b.ref] && <span className="text-xs text-muted-foreground">Uploading…</span>}
                            {!uploading[b.ref] && b.value && (
                                <span className="text-xs text-green-600">
                                    Uploaded ✓{" "}
                                    <a className="underline" href={b.value} target="_blank" rel="noopener noreferrer">preview</a>
                                </span>
                            )}
                            {uploadError[b.ref] && <span className="text-xs text-red-500">{uploadError[b.ref]}</span>}
                        </div>
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
                                placeholder={b.kind === "field" ? "Fallback if empty (optional)" : "Value"}
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
