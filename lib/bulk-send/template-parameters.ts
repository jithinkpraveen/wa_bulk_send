import {
    MessageTemplate,
    MessageTemplateBody,
    MessageTemplateButtons,
    MessageTemplateHeader,
} from "@/types/message-template";

// ---------------------------------------------------------------------------
// Variable bindings for a broadcast's template.
//
// A template can contain variables in its header text, body text, and dynamic
// URL buttons, plus a required media asset for media headers. When creating a
// broadcast the user binds each variable to either:
//   - a static value (same text for every recipient), or
//   - a contact field (resolved per-recipient at send time, e.g. their name).
//
// The resolved structure is stored on `broadcast.template_parameters` and is
// consumed by the send worker (supabase/functions/send-message-batch) to build
// the WhatsApp Cloud API `components` payload for each contact.
// ---------------------------------------------------------------------------

export type ContactField = "name" | "number";

export const CONTACT_FIELD_OPTIONS: { value: ContactField; label: string }[] = [
    { value: "name", label: "Contact name" },
    { value: "number", label: "Phone number" },
];

export type ParamKind = "static" | "field" | "media";

export type ParamBinding = {
    /** Stable id, e.g. "body:1", "body:first_name", "header:1", "header:media", "button:0". */
    ref: string;
    component: "header" | "body" | "button";
    kind: ParamKind;
    /** 1-based position for POSITIONAL templates. */
    position?: number;
    /** parameter name for NAMED templates. */
    paramName?: string;
    /** index of the button within the BUTTONS component (for kind != media). */
    buttonIndex?: number;
    buttonSubType?: "url";
    /** Media format for a media header (kind === "media"). */
    format?: "IMAGE" | "VIDEO" | "DOCUMENT";
    /** Human label shown in the form, e.g. "Body {{1}}". */
    label: string;
    /** static text / media link, OR the fallback used when a field is empty. */
    value: string;
    /** the contact field to resolve when kind === "field". */
    field?: ContactField;
};

export type TemplateParameters = {
    parameterFormat: "POSITIONAL" | "NAMED";
    bindings: ParamBinding[];
};

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function findComponent<T>(template: MessageTemplate, type: string): T | undefined {
    return template.components.find((c) => c.type === type) as T | undefined;
}

/** Ordered, de-duplicated list of placeholder tokens inside a string. */
function placeholderTokens(text: string | undefined): string[] {
    if (!text) return [];
    const tokens: string[] = [];
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
        const token = match[1];
        if (!tokens.includes(token)) tokens.push(token);
    }
    return tokens;
}

function isPositional(tokens: string[]): boolean {
    return tokens.every((t) => /^\d+$/.test(t));
}

/**
 * Inspect a fetched template definition and return the editable variable
 * bindings, pre-filled with the template's example values where available.
 * Returns `null` bindings list (empty) when the template needs no input.
 */
export function extractTemplateVariables(template: MessageTemplate): TemplateParameters {
    const bindings: ParamBinding[] = [];
    let named = false;

    const header = findComponent<MessageTemplateHeader>(template, "HEADER");
    if (header) {
        if (header.format === "TEXT") {
            const tokens = placeholderTokens(header.text);
            if (tokens.length > 0 && !isPositional(tokens)) named = true;
            const examples = header.example?.header_text ?? [];
            tokens.forEach((token, i) => {
                const positional = /^\d+$/.test(token);
                bindings.push({
                    ref: `header:${token}`,
                    component: "header",
                    kind: "static",
                    position: positional ? Number(token) : undefined,
                    paramName: positional ? undefined : token,
                    label: `Header {{${token}}}`,
                    value: examples[i] ?? "",
                });
            });
        } else if (header.format === "IMAGE" || header.format === "VIDEO" || header.format === "DOCUMENT") {
            bindings.push({
                ref: "header:media",
                component: "header",
                kind: "media",
                format: header.format,
                label: `Header ${header.format.toLowerCase()} URL`,
                value: "",
            });
        }
    }

    const body = findComponent<MessageTemplateBody>(template, "BODY");
    if (body) {
        const tokens = placeholderTokens(body.text);
        if (tokens.length > 0 && !isPositional(tokens)) named = true;
        // POSITIONAL example shape: body_text = [["v1","v2"]]; NAMED is handled via name match below.
        const positionalExamples = body.example?.body_text?.[0] ?? [];
        tokens.forEach((token, i) => {
            const positional = /^\d+$/.test(token);
            bindings.push({
                ref: `body:${token}`,
                component: "body",
                kind: "static",
                position: positional ? Number(token) : undefined,
                paramName: positional ? undefined : token,
                label: `Body {{${token}}}`,
                value: positional ? positionalExamples[i] ?? "" : "",
            });
        });
    }

    const buttons = findComponent<MessageTemplateButtons>(template, "BUTTONS");
    if (buttons) {
        // Buttons without a URL placeholder (or an absent/empty buttons array) need no
        // input and are intentionally skipped.
        (buttons.buttons ?? []).forEach((button, index) => {
            if (button.type === "URL" && button.url && placeholderTokens(button.url).length > 0) {
                bindings.push({
                    ref: `button:${index}`,
                    component: "button",
                    kind: "static",
                    buttonIndex: index,
                    buttonSubType: "url",
                    label: `Button "${button.text}" URL suffix`,
                    value: "",
                });
            }
        });
    }

    return { parameterFormat: named ? "NAMED" : "POSITIONAL", bindings };
}

export function hasVariables(template: MessageTemplate): boolean {
    return extractTemplateVariables(template).bindings.length > 0;
}
