import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { randomBytes } from 'crypto'

export async function POST(request: Request) {
    try {
        // Create Supabase client
        const supabase = await createClient()

        // Get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Generate a new API key
        const apiKey = `lks_${randomBytes(32).toString('hex')}`

        // Store the API key in the user's profile or a separate table
        // For now, we'll store it in the profile metadata
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                api_key: apiKey
            })
            .eq('id', user.id)

        if (updateError) {
            console.error('Update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to generate API key' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            apiKey: apiKey,
            message: 'API key generated successfully. Keep this safe!'
        })

    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function GET(request: Request) {
    try {
        // Create Supabase client
        const supabase = await createClient()

        // Get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Get the user's current API key
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('api_key')
            .eq('id', user.id)
            .single()

        if (profileError) {
            return NextResponse.json(
                { error: 'Failed to fetch API key' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            apiKey: profile?.api_key || null,
            hasKey: !!profile?.api_key
        })

    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
