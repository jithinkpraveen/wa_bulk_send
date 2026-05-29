// Builds the WhatsApp Cloud API `template.components` payload for a single
// recipient from the variable bindings the user configured when creating the
// broadcast (stored on broadcast.template_parameters).
//
// IMPORTANT: keep these types in sync with lib/bulk-send/template-parameters.ts
// (the Next.js side). They cannot share a module across the runtime boundary.

export type ContactField = "name" | "number";
export type ParamKind = "static" | "field" | "media";

export type ParamBinding = {
    ref: string;
    component: "header" | "body" | "button";
    kind: ParamKind;
    position?: number;
    paramName?: string;
    buttonIndex?: number;
    buttonSubType?: "url";
    format?: "IMAGE" | "VIDEO" | "DOCUMENT";
    label?: string;
    value: string;
    field?: ContactField;
};

export type TemplateParameters = {
    parameterFormat: "POSITIONAL" | "NAMED";
    bindings: ParamBinding[];
};

export type ContactLike = {
    wa_id: number | string;
    profile_name?: string | null;
};

function resolveValue(binding: ParamBinding, contact: ContactLike): string {
    if (binding.kind === "field") {
        if (binding.field === "name") {
            const name = (contact.profile_name ?? "").toString().trim();
            return name || binding.value || "";
        }
        if (binding.field === "number") {
            return contact.wa_id?.toString() ?? "";
        }
    }
    return binding.value ?? "";
}

function textParameter(binding: ParamBinding, contact: ContactLike, named: boolean) {
    const param: Record<string, unknown> = { type: "text", text: resolveValue(binding, contact) };
    if (named && binding.paramName) param.parameter_name = binding.paramName;
    return param;
}

const byPosition = (a: ParamBinding, b: ParamBinding) => (a.position ?? 0) - (b.position ?? 0);

export function buildTemplateComponents(
    parameters: TemplateParameters | null | undefined,
    contact: ContactLike,
): unknown[] {
    if (!parameters || !Array.isArray(parameters.bindings) || parameters.bindings.length === 0) {
        return [];
    }
    const named = parameters.parameterFormat === "NAMED";
    const components: unknown[] = [];

    // HEADER — either a media asset or text parameter(s).
    const headerBindings = parameters.bindings.filter((b) => b.component === "header");
    const media = headerBindings.find((b) => b.kind === "media");
    if (media && media.value) {
        const fmt = (media.format ?? "IMAGE").toLowerCase(); // image | video | document
        components.push({
            type: "header",
            parameters: [{ type: fmt, [fmt]: { link: media.value } }],
        });
    } else {
        const headerText = headerBindings.filter((b) => b.kind !== "media").sort(byPosition);
        if (headerText.length > 0) {
            components.push({
                type: "header",
                parameters: headerText.map((b) => textParameter(b, contact, named)),
            });
        }
    }

    // BODY — text parameters in order.
    const bodyBindings = parameters.bindings.filter((b) => b.component === "body").sort(byPosition);
    if (bodyBindings.length > 0) {
        components.push({
            type: "body",
            parameters: bodyBindings.map((b) => textParameter(b, contact, named)),
        });
    }

    // BUTTONS — dynamic URL suffix (one component per button).
    for (const b of parameters.bindings.filter((b) => b.component === "button")) {
        components.push({
            type: "button",
            sub_type: b.buttonSubType ?? "url",
            index: (b.buttonIndex ?? 0).toString(),
            parameters: [{ type: "text", text: resolveValue(b, contact) }],
        });
    }

    return components;
}
