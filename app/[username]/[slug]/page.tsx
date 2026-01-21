import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ItemEditor } from "@/components/feature/ItemEditor"

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
        .select('id')
        .eq('username', username)
        .single();

    if (profileError || !profile) {
        console.error("[PublicItemResolver] Profile error:", profileError, "for username:", username);
        notFound();
    }

    // 2. Resolve Item
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

    // 3. Handle Types
    if (item.type === 'link' || (item.type === 'clip' && item.content.startsWith('http'))) {
        // Redirect links
        // If content is not a valid URL (weird for type link), we fall back to view.
        if (item.content.match(/^https?:\/\//)) {
            redirect(item.content);
        }
    }

    // 4. Render View
    return (
        <ItemEditor snippet={item} readOnly={true} username={username} />
    );
}
