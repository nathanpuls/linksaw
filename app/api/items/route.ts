import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { content, title: customTitle } = body

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 })
        }

        const title = customTitle || ''
        const language = 'text'
        const type = content.trim().match(/^https?:\/\//) ? 'link' : 'snip';

        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
        const slug = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

        const { data, error } = await supabase
            .from('items')
            .insert({ title, content, language, slug, type })
            .select()
            .single()

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Revalidate the home page to show the new item
        revalidatePath('/')

        return NextResponse.json({
            success: true,
            item: data,
            message: "Item saved successfully!"
        })
    } catch (err: any) {
        console.error('API Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
