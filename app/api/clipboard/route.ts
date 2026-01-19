import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
    try {
        // Get the clipboard content from the request
        const body = await request.json()
        const { content, title, url } = body

        if (!content) {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            )
        }

        // Create Supabase client
        const supabase = await createClient()

        // Check for API key in Authorization header
        const authHeader = request.headers.get('authorization')
        let user = null

        if (authHeader) {
            // Handle both "Bearer [key]" and just "[key]"
            const apiKey = authHeader.startsWith('Bearer ')
                ? authHeader.substring(7)
                : authHeader

            // Look up user by API key
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('api_key', apiKey)
                .single()

            if (profileError || !profile) {
                return NextResponse.json(
                    { error: 'Invalid API key' },
                    { status: 401 }
                )
            }

            user = { id: profile.id }
        } else {
            // Fall back to session-based auth
            const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser()

            if (authError || !sessionUser) {
                return NextResponse.json(
                    { error: 'Unauthorized. Please provide an API key in the Authorization header or authenticate.' },
                    { status: 401 }
                )
            }

            user = sessionUser
        }

        // Detect if content is a URL
        const isUrl = /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(content.trim())
        const type = isUrl ? 'link' : 'clip'

        // Generate a title from content if not provided
        const itemTitle = title || (isUrl ? content : content.slice(0, 50)) || (isUrl ? 'Link' : 'Clipboard')

        // Create a new item
        const { data: item, error: insertError } = await supabase
            .from('items')
            .insert({
                user_id: user.id,
                type: type,
                title: itemTitle,
                content: content,
                source_url: url || 'iPhone Shortcut',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (insertError) {
            console.error('Insert error:', insertError)
            return NextResponse.json(
                { error: 'Failed to save clipboard content' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Clipboard saved successfully',
            item: item
        })

    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
