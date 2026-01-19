"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export function ItemRealtimeListener() {
    const router = useRouter()

    useEffect(() => {
        const channel = supabase
            .channel('realtime-items')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'items',
                },
                (payload) => {
                    // console.log('Change received!', payload)
                    router.refresh()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [router])

    return null
}
