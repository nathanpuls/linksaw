import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ItemEditor } from "@/components/feature/ItemEditor"
import { ItemList } from "@/components/feature/ItemList"
import { Shell } from "@/components/layout/Shell"

export const revalidate = 0;

export default async function ItemResolverPage(props: { params: Promise<{ username: string, slug: string }> }) {
    const params = await props.params;
    const username = decodeURIComponent(params.username);
    const slug = decodeURIComponent(params.slug);

    const supabase = await createClient();

    const reservedUsernames = ['app', 'api', 'auth', 'login', 'settings', 'static'];
    if (reservedUsernames.includes(username)) {
        notFound();
    }

    // 1. Resolve User
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', username)
        .single();

    if (profileError || !profile) {
        console.error("[PublicItemResolver] Profile error:", profileError, "for username:", username);
        notFound();
    }

    // 2. Handle Filter Views (clip, link, etc.)
    if (['clip', 'link', 'text'].includes(slug)) {
        let query = supabase
            .from('items')
            .select('*')
            .eq('user_id', profile.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (slug === 'clip') {
            query = query.eq('type', 'clip');
        } else if (slug === 'link') {
            query = query.eq('type', 'link');
        } else if (slug === 'text') {
            query = query.neq('type', 'link').neq('type', 'clip');
        }

        const { data: items } = await query;

        return (
            <Shell profile={profile} isReadOnly={true} pageTitle={`${slug}s`}>
                <ItemList
                    initialItems={items || []}
                    isReadOnly={true}
                    username={username}
                    displayName={profile?.full_name}
                />
            </Shell>
        );
    }

    // 3. Resolve Single Item
    const { data: item, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .or(`slug.eq.${slug},alias.eq.${slug}`)
        .single();

    if (itemError || !item) {
        console.error("[PublicItemResolver] Item error:", itemError, "for slug/alias:", slug, "user:", profile.id);
        notFound();
    }

    // 4. Handle Types
    if (item.type === 'link' || (item.type === 'clip' && item.content.startsWith('http'))) {
        // Redirect links
        // If content is not a valid URL (weird for type link), we fall back to view.
        if (item.content.match(/^https?:\/\//)) {
            redirect(item.content);
        }
    }

    // 5. Render View
    return (
        <ItemEditor snippet={item} readOnly={true} username={username} />
    );
}
