"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function NewItemButton() {
    const router = useRouter()

    useEffect(() => {
        // Prefetch the new item page for instant navigation
        router.prefetch('/items/new')

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLPreElement) {
                return;
            }

            if (e.key.toLowerCase() === 'n') {
                e.preventDefault()
                router.push('/items/new')
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [router])

    return (
        <Link href="/items/new">
            <Button className="bg-white text-black border border-input shadow-sm hover:bg-neutral-100 hover:text-black relative pr-12 transition-colors">
                New
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded border border-black/10 bg-black/5 text-[10px] font-medium opacity-50">
                    N
                </span>
            </Button>
        </Link>
    )
}
