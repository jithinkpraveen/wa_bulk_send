import { createClient as createBrowserClient } from "@/utils/supabase-browser";
import { MessageTemplate, MessageTemplateComponent } from "@/types/message-template";
import { MessageTemplateRepository } from "./MessageTemplateRepository";

type SupabaseClientType = ReturnType<typeof createBrowserClient>

export class MessageTemplateRepositorySupabaseImpl implements MessageTemplateRepository {
    private client;
    constructor(client: SupabaseClientType) {
        this.client = client;
    }

    async getMessageTemplateUniqueNames(): Promise<string[]> {
        let { data, error } = await this.client
            .from('message_template')
            .select('*')
        if (error) throw error
        const uniqueTemplates: string[] = []
        data?.forEach((messageTemplate) => {
            if (!uniqueTemplates.includes(messageTemplate.name)) {
                uniqueTemplates.push(messageTemplate.name)
            }
        })
        return uniqueTemplates
    }

    async getMessageTemplateLanguages(messageTemplateName: string): Promise<string[]> {
        let { data, error } = await this.client
            .from('message_template')
            .select('language')
            .eq('name', messageTemplateName)
            if (error) throw error
        return data?.map(item => item.language) || []
    }

    async getMessageTemplate(name: string, language: string): Promise<MessageTemplate | null> {
        const { data, error } = await this.client
            .from('message_template')
            .select('*')
            .eq('name', name)
            .eq('language', language)
            .limit(1)
            .maybeSingle()
        if (error) throw error
        if (!data) return null
        return {
            id: data.id,
            name: data.name ?? name,
            language: data.language ?? language,
            status: data.status ?? '',
            category: data.category ?? '',
            previous_category: data.previous_category,
            components: (data.components as unknown as MessageTemplateComponent[]) ?? [],
        }
    }
}