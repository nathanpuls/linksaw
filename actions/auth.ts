'use server'

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function signInWithGoogle() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
            queryParams: {
                prompt: 'select_account consent',
            },
        },
    })

    if (error) {
        console.error('Auth error:', error)
        redirect('/error')
    }

    if (data.url) {
        redirect(data.url)
    }
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}

export async function switchAccount() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    await signInWithGoogle()
}
