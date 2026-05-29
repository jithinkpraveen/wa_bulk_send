'use server';

import { createClient as createServerClient } from '@/utils/supabase-server';
import { MessageTemplate } from '@/types/message-template';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import MessageTemplateServerFactory from '../repositories/message-template/MessageTemplateServerFactory';
import { TemplateParameters } from './template-parameters';

const schema = z.object({
    broadcast_name: z.string().min(1, 'Broadcast name is required'),
    message_template: z.string().min(1, 'Message template is required'),
    language: z.string().min(1, 'Language is required'),
    contact_tags: z.string().optional(),
    template_parameters: z.string().optional(),
});

type BulkSendRequest = {
    name: string,
    messageTemplate: string,
    language: string,
    contactTags: string[],
    templateParameters: TemplateParameters | null,
    csvData?: string,
}

export async function getTemplateLanguges(templateName: string): Promise<string[]> {
    const messageTemplateRepo = MessageTemplateServerFactory.getInstance()
    return await messageTemplateRepo.getMessageTemplateLanguages(templateName)
}

export async function getTemplate(name: string, language: string): Promise<MessageTemplate | null> {
    const messageTemplateRepo = MessageTemplateServerFactory.getInstance()
    return await messageTemplateRepo.getMessageTemplate(name, language)
}

export async function bulkSend(prevState: { message: string }, formData: FormData) {
    const parsed = schema.safeParse({
        broadcast_name: formData.get('broadcast_name'),
        message_template: formData.get('message_template'),
        contact_tags: formData.get('contact_tags') ?? undefined,
        language: formData.get('language'),
        template_parameters: formData.get('template_parameters') ?? undefined,
    });
    if (!parsed.success) {
        return { message: parsed.error.errors[0]?.message ?? 'Invalid form' };
    }

    // Audience can be an uploaded CSV (auto-tagged with the broadcast name) or
    // selected existing tags.
    const csvFile = formData.get('csv_file');
    const hasCsv = csvFile instanceof File && csvFile.size > 0;
    const csvData = hasCsv ? await (csvFile as File).text() : undefined;

    let contactTags: string[] = [];
    if (parsed.data.contact_tags) {
        try {
            contactTags = JSON.parse(parsed.data.contact_tags);
        } catch {
            return { message: 'Invalid contact tags' };
        }
    }
    if (!hasCsv && (!Array.isArray(contactTags) || contactTags.length === 0)) {
        return { message: 'Select at least one contact tag or upload a CSV' };
    }

    let templateParameters: TemplateParameters | null = null;
    if (parsed.data.template_parameters) {
        try {
            templateParameters = JSON.parse(parsed.data.template_parameters);
        } catch {
            return { message: 'Invalid template parameters' };
        }
    }

    const bulkSendRequest: BulkSendRequest = {
        name: parsed.data.broadcast_name,
        messageTemplate: parsed.data.message_template,
        language: parsed.data.language,
        contactTags,
        templateParameters,
        csvData,
    }
    const supabase = createServerClient()
    const { error } = await supabase.functions.invoke('bulk-send', {
        body: bulkSendRequest
    })
    if (error) {
        let message = "Could not start the broadcast. Please try again."
        // The function returns its real error in the response body; read it as text
        // (logging it too, so it is visible in the server console).
        let bodyText = ''
        try {
            bodyText = await (error as { context?: { text?: () => Promise<string> } })?.context?.text?.() ?? ''
        } catch { /* body may be unavailable */ }
        console.error('error while initiating bulk send. response body:', bodyText || '(empty)')
        try {
            const parsed = bodyText ? JSON.parse(bodyText) : null
            if (parsed?.error) message = parsed.error
        } catch { /* keep generic message */ }
        return { message }
    }
    revalidatePath('/bulk-send', 'page');
    redirect('/bulk-send');
}
