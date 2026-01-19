import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
    console.log('[API] Incoming Clipboard Request')
    console.log('[API] Method:', request.method)

    const contentType = request.headers.get('content-type') || ''
    console.log('[API] Content-Type:', contentType)

    // Try to get content from JSON or FormData
    let content, title, url

    if (contentType.includes('application/json')) {
        console.log('[API] Attempting to parse JSON...')
        try {
            const body = await request.json()
            console.log('[API] JSON parsed:', { ...body, content: body.content?.substring(0, 20) + '...' })
            content = body.content
            title = body.title
            url = body.url
        } catch (e) {
            console.error('[API] JSON Parse Error:', e)
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            )
        }
    } else {
        console.log('[API] Attempting to parse FormData...')
        try {
            const formData = await request.formData()
            console.log('[API] FormData keys:', Array.from(formData.keys()))
            content = formData.get('content')
            title = formData.get('title')
            url = formData.get('url')
        } catch (e) {
            console.error('[API] FormData Parse Error:', e)
            return NextResponse.json(
                { error: 'Invalid request format' },
                { status: 400 }
            )
        }
    }

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

}
