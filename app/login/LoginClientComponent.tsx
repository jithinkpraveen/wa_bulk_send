"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { MessageCircle } from "lucide-react";
import { useSupabase } from "../../components/supabase-provider";

export default function LoginClientComponent() {
    const { supabase } = useSupabase()
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-md rounded-xl border bg-white shadow-sm p-8">
                <div className="flex flex-col items-center gap-2 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <MessageCircle className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Carehands</h1>
                    <p className="text-sm text-muted-foreground">Sign in to manage your WhatsApp messaging</p>
                </div>
                <Auth
                    supabaseClient={supabase}
                    appearance={{
                        theme: ThemeSupa,
                        variables: {
                            default: {
                                colors: {
                                    brand: 'hsl(169 100% 25%)',
                                    brandAccent: 'hsl(169 100% 20%)',
                                },
                            },
                        },
                    }}
                    providers={[]}
                />
            </div>
        </div>
    )
}
