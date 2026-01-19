import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { content, url } = body

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 })
        }

        const type = 'clip';
        const title = content.slice(0, 30) || 'Clipboard Item';
        const language = 'text';

        // Generate random slug 
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const slug = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

        const { data, error } = await supabase
            .from('items')
            .insert({
                content,
                source_url: url || 'iPhone',
                type,
                title,
                slug,
                language
            })
            .select()
            .single()

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            item: data
        })
    } catch (err: any) {
        console.error('API Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
