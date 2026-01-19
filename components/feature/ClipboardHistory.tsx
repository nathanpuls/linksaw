'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Clipboard, Clock, Copy, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export function ClipboardHistory() {
    const [history, setHistory] = useState<any[]>([])
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [open, setOpen] = useState(false)

    const fetchHistory = async () => {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('type', 'clip')
            .order('created_at', { ascending: false })
            .limit(20)

        if (data) setHistory(data)
    }

    useEffect(() => {
        fetchHistory()

        // Realtime subscription for new clipboard items
        // We filter for type='clip' if RLS allows, otherwise client-side filter might be needed if update listener is broad
        const channel = supabase
            .channel('items-clips')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'items',
                    filter: 'type=eq.clip'
                },
                () => fetchHistory()
            )
            .subscribe()

        // Keyboard shortcut 'C' to open history
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in an input or textarea
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable
            ) {
                return
            }

            if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                setOpen(true)
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            supabase.removeChannel(channel)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    const handleCopy = async (id: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedId(id)
            toast.success("Copied to clipboard")
            setTimeout(() => setCopiedId(null), 2000)
        } catch (err) {
            toast.error("Failed to copy")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative group/history">
                    <Clipboard className="h-5 w-5" />
                    <span className="sr-only">Clipboard History</span>
                    <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-muted px-1 rounded opacity-0 group-hover/history:opacity-100 transition-opacity">C</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Clipboard className="h-5 w-5" />
                        Clipboard History
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-2">
                    {history.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                            No history yet. Copy something in Chrome!
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border"
                                    onClick={() => handleCopy(item.id, item.content)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm line-clamp-2 break-words text-foreground">
                                            {item.content}
                                        </p>
                                        {item.source_url && (
                                            <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-full italic">
                                                {item.source_url.startsWith('http') ? (
                                                    <a
                                                        href={item.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="underline hover:text-foreground transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {new URL(item.source_url).hostname}
                                                    </a>
                                                ) : (
                                                    <span>{item.source_url}</span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 shrink-0 text-muted-foreground"
                                    >
                                        {copiedId === item.id ? (
                                            <Check className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
