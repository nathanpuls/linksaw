import { SearchBar } from "@/components/feature/SearchBar";
import { ItemList } from "@/components/feature/ItemList";
import { ClipboardHistory } from "@/components/feature/ClipboardHistory";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { NewItemButton } from "@/components/feature/NewItemButton";
import { ItemRealtimeListener } from "@/components/feature/ItemRealtimeListener";
import { UsernameModal } from "@/components/feature/UsernameModal";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Shell } from "@/components/layout/Shell";
import { navItems } from "@/lib/nav-items";

export const revalidate = 0;

export default async function Home(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams;
    const query = (searchParams.q as string)?.toLowerCase() || '';
    const typeFilter = (searchParams.type as string) || '';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Landing Page for Unauthenticated Users
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                <div className="relative w-24 h-24 mb-6 rounded-full overflow-hidden shadow-lg">
                    <img
                        src="/logo.svg"
                        alt="Linksaw Logo"
                        className="w-full h-full object-cover"
                    />
                </div>
                <h1 className="text-4xl font-bold mb-4">linksaw</h1>
                <p className="text-muted-foreground mb-8">Personal link and clip manager.</p>
                <Link href="/app/login">
                    <Button>Sign In</Button>
                </Link>

                <div className="absolute bottom-4 flex gap-6 text-sm text-muted-foreground">
                    <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
                    <Link href="/terms" className="hover:underline">Terms of Service</Link>
                </div>
            </div>
        )
    }

    // Fetch Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    // Fetch Items
    let queryBuilder = supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id) // Strict filtering by user
        .is('deleted_at', null)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });

    // Apply Type Filter
    if (typeFilter) {
        if (typeFilter === 'clip') {
            queryBuilder = queryBuilder.eq('type', 'clip');
        } else if (typeFilter === 'link') {
            queryBuilder = queryBuilder.eq('type', 'link');
        } else if (typeFilter === 'text' || typeFilter === 'snip') {
            queryBuilder = queryBuilder.neq('type', 'link').neq('type', 'clip'); // 'text' (formerly snip) is everything else
        }
    } else {
        // Default view: Show everything including clips
    }

    if (query) {
        // If searching, search across everything valid for the current view?
        // Or restart builder?
        // Re-applying logic with search
        queryBuilder = supabase
            .from('items')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: false });

        if (typeFilter) {
            if (typeFilter === 'clip') queryBuilder = queryBuilder.eq('type', 'clip');
            if (typeFilter === 'link') queryBuilder = queryBuilder.eq('type', 'link');
            if (typeFilter === 'text' || typeFilter === 'snip') queryBuilder = queryBuilder.neq('type', 'link').neq('type', 'clip');
        } else {
            queryBuilder = queryBuilder.neq('type', 'clip');
        }
    }

    const { data: snippets, error } = await queryBuilder;

    if (query) {
        console.log(`[Search] Query: "${query}", Results: ${snippets?.length || 0}`);
    }

    if (error) {
        console.error("Error fetching items:", error);
    }

    const showUsernameModal = !profile?.username;
    const pageTitle = typeFilter ? `${typeFilter}s` : 'All Items';

    return (
        <Shell profile={profile} user={user} pageTitle={pageTitle}>
            <UsernameModal initialIsOpen={showUsernameModal} />
            <ItemList initialItems={snippets || []} username={profile?.username} displayName={profile?.full_name} />
            <ItemRealtimeListener />

            {/* Mobile Floating Action Button */}
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <Link href="/app/items/new">
                    <Button size="icon" className="h-14 w-14 rounded-full bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black shadow-lg">
                        <Plus className="h-6 w-6" />
                        <span className="sr-only">New Item</span>
                    </Button>
                </Link>
            </div>
        </Shell>
    );
}
