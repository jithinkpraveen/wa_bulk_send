'use client';

import { Label } from '@radix-ui/react-label'
import React, { useState } from 'react'
import { getTemplate, getTemplateLanguges } from '@/lib/bulk-send';
import { extractTemplateVariables, TemplateParameters } from '@/lib/bulk-send/template-parameters';
import { SelectOption, SingleSelectDropdown, emptyOption } from './SingleSelectDropdown'
import TemplateVariablesInput from './TemplateVariablesInput';

export default function MessageTemplateWithLanguage({ messageTemplates: messageTemplatesOptions }: { messageTemplates: SelectOption[] }) {
    const [messageTemplate, setMessageTemplate] = useState<SelectOption>(emptyOption)
    const [language, setLanguage] = useState<string>('')
    const [parameters, setParameters] = useState<TemplateParameters | null>(null)
    const [loading, setLoading] = useState(false)

    // The language is resolved automatically from the selected template (using its
    // only / first available variant) — the user just picks a template.
    async function onMessageTemplateChange(option: SelectOption) {
        setMessageTemplate(option)
        setParameters(null)
        setLanguage('')
        if (!option.value) return
        setLoading(true)
        try {
            const languages = await getTemplateLanguges(option.value)
            const chosen = languages[0] ?? ''
            setLanguage(chosen)
            if (chosen) {
                const template = await getTemplate(option.value, chosen)
                if (template) setParameters(extractTemplateVariables(template))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="grid gap-1.5">
                <Label htmlFor="message_template">Message Template</Label>
                <SingleSelectDropdown name="message_template" displayName="message template"
                    className="w-[20rem]" options={messageTemplatesOptions}
                    value={messageTemplate} onChange={onMessageTemplateChange} />
                {language && <p className="text-xs text-muted-foreground">Language: {language}</p>}
            </div>
            {/* Language is auto-resolved from the template; submitted via this hidden input. */}
            <input type="hidden" name="language" value={language} />
            {loading && <p className="text-sm text-muted-foreground">Loading template…</p>}
            {parameters && parameters.bindings.length > 0 && (
                <>
                    <TemplateVariablesInput parameters={parameters} onChange={setParameters} />
                    <input type="hidden" name="template_parameters" value={JSON.stringify(parameters)} />
                </>
            )}
        </>
    )
}
