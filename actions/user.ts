'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function claimUsername(username: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    // Validate username format (e.g., alphanumeric, no spaces, starts with @?)
    // Request says "@username" in URL, but stored in DB presumably without @ or we check?
    // "each username would be like linksaw.com/@username"
    // Usually DB stores "username", and URL adds "@".
    // I'll enforce alphanumeric, lowercase.
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
        throw new Error('Username must be 3-30 characters, alphanumeric or underscore.')
    }

    const reserved = [
        'app', 'api', 'auth', 'login', 'logout', 'settings', 'admin', 'dashboard', 'privacy', 'terms',
        'link', 'links', 'clip', 'clips', 'user', 'users', 'item', 'items', 'search', 'public',
        'static', 'images', 'assets', 'help', 'support', 'faq', 'contact', 'team', 'about',
        'pricing', 'features', 'new', 'edit', 'verify'
    ];

    if (reserved.includes(cleanUsername)) {
        throw new Error('This username is reserved.')
    }

    // Check availability
    const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .single()

    if (existing && existing.id !== user.id) {
        throw new Error('Username already taken')
    }

    // Upsert profile
    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            username: cleanUsername,
            updated_at: new Date().toISOString()
        })

    if (error) {
        if (error.code === '23505') { // Unique violation
            throw new Error('Username already taken')
        }
        throw new Error('Failed to update profile: ' + error.message)
    }

    revalidatePath('/')
}

export async function getProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return data
}

export async function updateProfileVisibility(isPublic: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    const { error } = await supabase
        .from('profiles')
        .update({ is_public: isPublic, updated_at: new Date().toISOString() })
        .eq('id', user.id)

    if (error) {
        throw new Error('Failed to update visibility: ' + error.message)
    }

    revalidatePath('/app/settings')
    revalidatePath('/')
}
