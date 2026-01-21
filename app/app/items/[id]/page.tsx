import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ItemEditor } from "@/components/feature/ItemEditor";

export const revalidate = 0;

export default async function ItemPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

    const supabase = await createClient(); // Use authenticated server client

    let query = supabase
        .from('items')
        .select('*')
        .is('deleted_at', null);

    if (isUuid) {
        query = query.eq('id', params.id);
    } else {
        query = query.or(`slug.eq.${params.id},alias.eq.${params.id}`);
    }

    const { data: item, error } = await query.single();

    if (error) {
        console.error("Error fetching item:", error);
    }

    if (error || !item) {
        notFound();
    }

    // Canonical redirect: If accessed via UUID but a slug exists, redirect to slug
    if (isUuid && item.slug) {
        redirect(`/app/items/${item.slug}`);
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch profile for username
    const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', item.user_id)
        .single();

    const username = profile?.username;

    return <ItemEditor snippet={item} username={username} />;
}
