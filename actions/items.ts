'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

function determineType(content: string): 'link' | 'snip' {
    return content.trim().match(/^https?:\/\//) ? 'link' : 'snip';
}

export async function updateItem(id: string, formData: FormData, slug?: string) {
    const supabase = await createClient()
    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const language = formData.get('language') as string

    // Check if alias is being updated. 
    // The form will always send 'alias' if using the new editor.
    // If it sends "", we set to null.
    // If it sends a value, we set it.

    let alias = null;
    let shouldUpdateAlias = false;

    if (formData.has('alias')) {
        const raw = formData.get('alias') as string;
        shouldUpdateAlias = true;

        if (raw && raw.trim() !== '') {
            alias = raw.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
            if (alias.length < 2) alias = null;
        }
    } else if (title && title !== 'Untitled' && title !== 'Untitled Item') {
        // Sync alias to title for card-view renames
        const candidate = title.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        if (candidate.length >= 2) {
            alias = candidate;
            shouldUpdateAlias = true;
        }
    }

    const type = determineType(content)

    const updateData: any = { title, content, language, type };
    if (shouldUpdateAlias) {
        updateData.alias = alias;
    }

    const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', id)

    if (error) {
        throw new Error('Failed to update item: ' + error.message)
    }

    revalidatePath('/')
    revalidatePath(`/items/${id}`)
    if (slug) {
        revalidatePath(`/items/${slug}`)
    }
}

export async function createItem(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // For public demo/testing without auth, this might fail unless we allow nullable user_id
        // But request implies "user-owned", so we should enforce auth.
        // If the current user is not logged in, we should probably redirect to login.
        // For now, let's treat it as error.
        throw new Error('You must be logged in to create items')
    }

    const content = (formData.get('content') as string) || ''
    const title = 'Untitled'; // Default to Untitled in DB, but UI will hide it if it matches 'Untitled'
    const language = 'text';
    const type = determineType(content)

    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const slug = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { data, error } = await supabase
        .from('items')
        .insert({
            title,
            content,
            language,
            slug,
            type,
            user_id: user.id
        })
        .select('slug')
        .single()

    if (error) {
        throw new Error('Failed to create item: ' + error.message)
    }

    revalidatePath('/')
    redirect('/')
}

export async function deleteItem(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

    if (error) {
        throw new Error('Failed to delete item')
    }

    revalidatePath('/')
    revalidatePath(`/items/${id}`)
}

export async function restoreItem(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('items')
        .update({ deleted_at: null })
        .eq('id', id)

    if (error) {
        throw new Error('Failed to restore item')
    }

    revalidatePath('/')
    revalidatePath(`/items/${id}`)
}

export async function updateItemOrder(orderedIds: string[]) {
    const supabase = await createClient()

    // This loops is inefficient for many items, but fine for small lists
    // Better to use a stored procedure or single query if possible
    const promises = orderedIds.map((id, index) =>
        supabase
            .from('items')
            .update({ order_index: index })
            .eq('id', id)
    )

    await Promise.all(promises)
    revalidatePath('/')
}

