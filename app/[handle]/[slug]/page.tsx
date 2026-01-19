import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ItemEditor } from "@/components/feature/ItemEditor"

export const revalidate = 0;

export default async function ItemResolverPage(props: { params: Promise<{ handle: string, slug: string }> }) {
    const params = await props.params;
    const handle = decodeURIComponent(params.handle);
    const slug = decodeURIComponent(params.slug);

    if (!handle.startsWith('@')) {
        notFound();
    }

    const username = handle.slice(1);
    const supabase = await createClient();

    // 1. Resolve User
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

    if (!profile) {
        notFound();
    }

    // 2. Resolve Item
    // We check both slug and alias.
    // Since alias is unique per user (allegedly) and slug is unique per user (allegedly global but definitely per user),
    // we can check if either matches.
    const { data: item } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .or(`slug.eq.${slug},alias.eq.${slug}`)
        .single();

    if (!item) {
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
