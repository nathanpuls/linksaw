'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ShortcutManagerProps {
    username?: string
}

export function ShortcutManager({ username }: ShortcutManagerProps) {
    const router = useRouter()

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable
            ) {
                return
            }

            const key = e.key.toLowerCase()

            // Avoid triggering shortcuts with modifiers
            if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
                return
            }

            switch (key) {
                case 'h':
                    router.push('/')
                    break
                case 'l':
                    router.push('/?type=link')
                    break
                case 't':
                    router.push('/?type=text')
                    break
                case 'c':
                    router.push('/?type=clip')
                    break
                case 's':
                    router.push('/app/settings')
                    break
                case 'p':
                    if (username) {
                        router.push(`/${username}`)
                    }
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [router, username])

    return null
}
