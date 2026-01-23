import { SearchBar } from "@/components/feature/SearchBar";
import { signInWithGoogle } from "@/actions/auth";
import { ItemList } from "@/components/feature/ItemList";
import { ClipboardHistory } from "@/components/feature/ClipboardHistory";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { NewItemButton } from "@/components/feature/NewItemButton";
import { ItemRealtimeListener } from "@/components/feature/ItemRealtimeListener";
import { UsernameModal } from "@/components/feature/UsernameModal";
import { Plus, Link2, FileCode, Clipboard, Zap, Shield, Sparkles } from "lucide-react";
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
            <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
                {/* Hero Section */}
                <div className="container mx-auto px-4 py-12 md:py-16">
                    <div className="max-w-4xl mx-auto text-center space-y-8">
                        {/* Logo & Brand */}
                        <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <div className="flex items-center gap-2">
                                <div className="relative w-16 h-16 rounded-full overflow-hidden">
                                    <img
                                        src="/logo.svg"
                                        alt="Linksaw Logo"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                    linksaw
                                </h1>
                            </div>

                            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
                                Your personal <span className="text-foreground font-semibold">link</span>, <span className="text-foreground font-semibold">text</span>, and <span className="text-foreground font-semibold">clipboard</span> manager
                            </p>
                        </div>

                        {/* CTA */}
                        <div className="pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                            <form action={signInWithGoogle}>
                                <Button size="lg" className="w-full max-w-md py-6 text-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-lg hover:shadow-xl transition-all">
                                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Continue with Google
                                </Button>
                            </form>
                            <p className="text-xs text-muted-foreground pt-4">
                                By continuing, you agree to our <Link href="/terms" className="underline hover:text-foreground">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div className="container mx-auto px-4 py-8 md:py-12">
                    <div className="max-w-6xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            Everything you need, all in <span className="relative inline-block">
                                one place
                                <svg className="absolute -bottom-1 left-0 w-full h-3" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                                    <path d="M0 6 Q50 2, 100 6 T200 6" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" fill="none" />
                                </svg>
                            </span>
                        </h2>

                        <div className="grid md:grid-cols-3 gap-8">
                            {/* Feature 1: Links */}
                            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Link2 className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Save Links</h3>
                                    <p className="text-muted-foreground">
                                        Bookmark important URLs and access them from anywhere. Share your favorite links with custom short URLs.
                                    </p>
                                </div>
                            </div>

                            {/* Feature 2: Code Snippets */}
                            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <FileCode className="h-6 w-6 text-purple-500" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Text Snippets</h3>
                                    <p className="text-muted-foreground">
                                        Store reusable text snippets, templates, and notes. Perfect for developers and writers.
                                    </p>
                                </div>
                            </div>

                            {/* Feature 3: Clipboard History */}
                            <div className="group relative p-8 rounded-2xl border bg-card hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Clipboard className="h-6 w-6 text-green-500" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Clipboard Manager</h3>
                                    <p className="text-muted-foreground">
                                        Never lose what you copy. Access your clipboard history and paste from anywhere.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Benefits Section */}
                <div className="container mx-auto px-4 py-16 md:py-24 bg-muted/50">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            Why choose <span className="font-extrabold text-foreground">linksaw</span>?
                        </h2>

                        <div className="space-y-8">
                            <div className="flex items-start gap-4 p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                                    <Zap className="h-5 w-5 text-yellow-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-1">Lightning Fast</h3>
                                    <p className="text-muted-foreground">
                                        Instant search and access to all your saved items. No more digging through bookmarks or notes.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <Shield className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-1">Secure & Private</h3>
                                    <p className="text-muted-foreground">
                                        Your data is encrypted and stored securely. Only you have access to your items unless you choose to share them.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-6 rounded-xl bg-card border hover:shadow-lg transition-shadow">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                    <Sparkles className="h-5 w-5 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-1">Integrations</h3>
                                    <p className="text-muted-foreground">
                                        Browser extension for one-click saving. Apple Shortcuts for iOS automation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer with Links */}
                <div className="container mx-auto px-4 py-8 border-t">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                        <p>© 2026 Linksaw. All rights reserved.</p>
                        <div className="flex gap-6">
                            <Link href="/privacy" className="hover:underline hover:text-foreground">Privacy Policy</Link>
                            <Link href="/terms" className="hover:underline hover:text-foreground">Terms of Service</Link>
                        </div>
                    </div>
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
