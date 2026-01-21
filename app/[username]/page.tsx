import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ItemList } from "@/components/feature/ItemList"
import { SearchBar } from "@/components/feature/SearchBar"
import { Shell } from "@/components/layout/Shell"
import Link from "next/link"
import Image from "next/image"

export const revalidate = 0;

export default async function UserProfilePage(props: { params: Promise<{ username: string }> }) {
    const params = await props.params;
    const username = decodeURIComponent(params.username);
    const supabase = await createClient();

    const reservedUsernames = ['app', 'api', 'auth', 'login', 'settings', 'static'];
    if (reservedUsernames.includes(username)) {
        notFound();
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', username)
        .single();

    if (profileError || !profile) {
        console.error("[PublicProfile] Profile error:", profileError, "for username:", username);
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
        <Shell profile={profile} isReadOnly={true}>
            <ItemList initialItems={items || []} isReadOnly={true} username={username} displayName={profile?.full_name} />
        </Shell>
    );
}
