import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ItemList } from "@/components/feature/ItemList"
import { SearchBar } from "@/components/feature/SearchBar"
import Link from "next/link"
import Image from "next/image"

export const revalidate = 60; // Revalidate every minute? Or 0?

export default async function UserProfilePage(props: { params: Promise<{ handle: string }> }) {
    const params = await props.params;
    const handle = decodeURIComponent(params.handle);

    // Validate handle format (must start with @)
    if (!handle.startsWith('@')) {
        notFound();
    }

    const username = handle.slice(1);
    const supabase = await createClient();

    // Fetch user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', username)
        .single();

    if (!profile) {
        notFound();
    }

    // Fetch public items (excluding clips)
    // TODO: Privacy model? For now assuming all snips/links are public on profile
    // But maybe we should only show specific ones? 
    // "Everything a user creates lives in a flat, user-owned namespace... accessed directly at linksaw.com/@item-name"
    // Usually implies public utility.

    const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .neq('type', 'clip')
        .order('created_at', { ascending: false });

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl hover:opacity-80 transition-opacity">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden">
                            <Image
                                src="/logo.png"
                                alt="Linksaw Logo"
                                fill
                                className="object-cover"
                            />
                        </div>
                        linksaw
                    </Link>
                    <div className="text-sm text-muted-foreground">
                        {profile.username}'s Space
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">{handle}</h1>
                    <p className="text-muted-foreground">{items?.length || 0} items</p>
                </div>

                <ItemList initialItems={items || []} isReadOnly={true} />
            </main>
        </div>
    );
}
