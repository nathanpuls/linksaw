import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in search params, use it as the redirection URL after successful sign in
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // Use NEXT_PUBLIC_SITE_URL for production redirects
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
            return NextResponse.redirect(`${siteUrl}${next}`)
        }
    }

    // return the user to an error page with instructions
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
    return NextResponse.redirect(`${siteUrl}/auth/auth-code-error`)
}
