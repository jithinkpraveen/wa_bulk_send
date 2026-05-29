'use client';

import { useSupabase } from "@/components/supabase-provider";
import { Button } from "@/components/ui/button";
import { LogOut, MessageCircle, Send, Users } from "lucide-react";
import Link from 'next/link';
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

const navItems = [
    { href: '/chats', label: 'Chats', icon: MessageCircle },
    { href: '/contacts', label: 'Contacts', icon: Users },
    { href: '/bulk-send', label: 'Bulk Send', icon: Send },
];

export default function PanelClient({ children }: { children: ReactNode }) {
    const activePath = usePathname();
    const { supabase } = useSupabase();
    const router = useRouter();

    async function onLogout() {
        await supabase.auth.signOut();
        router.replace('/login');
    }

    return (
        <div className="flex flex-row h-screen">
            <aside className="w-60 shrink-0 border-r bg-white flex flex-col">
                <div className="flex items-center gap-2 px-5 h-16 border-b">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <MessageCircle className="h-5 w-5" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight">Carehands</span>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const active = activePath?.startsWith(href);
                        return (
                            <Link key={href} href={href}>
                                <Button variant={active ? "default" : "ghost"} className="w-full justify-start gap-3">
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </Button>
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-3 border-t">
                    <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={onLogout}>
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </aside>
            <main className="flex-1 min-w-0 p-4">
                {children}
            </main>
        </div>
    )
}
