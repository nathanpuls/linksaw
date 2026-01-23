import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ItemList } from "@/components/feature/ItemList"
import { SearchBar } from "@/components/feature/SearchBar"
import { Shell } from "@/components/layout/Shell"
import Link from "next/link"
import Image from "next/image"


export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
    const params = await props.params;
    const username = decodeURIComponent(params.username);
    const supabase = await createClient();

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('username', username)
        .single();

    if (!profile) {
        return {
            title: 'User Not Found',
        };
    }

    const title = `${profile.full_name || profile.username} on Linksaw`;
    const description = `Check out ${profile.full_name || profile.username}'s curated links and clips.`;

    return {
        title: title,
        description: description,
        openGraph: {
            title: title,
            description: description,
            type: 'website',
        },
        twitter: {
            card: 'summary',
            title: title,
            description: description,
        }
    };
}

export const revalidate = 0;

export default async function UserProfilePage(props: { params: Promise<{ username: string }> }) {
    const params = await props.params;
    const username = decodeURIComponent(params.username);
    const supabase = await createClient();

    const reservedUsernames = ['app', 'api', 'auth', 'login', 'settings', 'static'];
    if (reservedUsernames.includes(username)) {
        notFound();
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, render_markdown')
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
        .order('created_at', { ascending: false });

    return (
        <Shell profile={profile} isReadOnly={true}>
            <ItemList
                initialItems={items || []}
                isReadOnly={true}
                username={username}
                displayName={profile?.full_name}
                renderMarkdown={profile?.render_markdown || false}
            />
        </Shell>
    );
}
