"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Pencil, GripVertical } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { ItemDeleteButton } from "./ItemDeleteButton"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useDebouncedCallback } from "use-debounce"
import { updateItem } from "@/actions/items"

interface ItemCardProps {
    id: string
    title: string
    content: string
    language?: string
    slug?: string
    onClick?: () => void
}

export function ItemCard({ id, title: initialTitle, content, language, slug, onClick, dragHandleProps }: ItemCardProps & { dragHandleProps?: any }) {
    const router = useRouter()
    // If title is explicitly 'Untitled Item' (legacy default) or just 'Untitled', treat as empty for UX
    const displayTitle = (initialTitle === 'Untitled Item' || initialTitle === 'Untitled') ? '' : initialTitle
    const [title, setTitle] = useState(displayTitle)

    // Sync state with props when server-side data refreshes (Realtime)
    useEffect(() => {
        setTitle((initialTitle === 'Untitled Item' || initialTitle === 'Untitled') ? '' : initialTitle)
    }, [initialTitle])

    // Simple URL detection
    const isUrl = content.trim().startsWith('http://') || content.trim().startsWith('https://');

    const debouncedUpdateTitle = useDebouncedCallback(async (newTitle: string) => {
        const formData = new FormData()
        formData.append('title', newTitle)
        formData.append('content', content)
        formData.append('language', language || 'text')

        try {
            await updateItem(id, formData, slug)
        } catch (err) {
            toast.error("Failed to update title")
        }
    }, 1000)

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value
        setTitle(newTitle)
        debouncedUpdateTitle(newTitle)
    }

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await navigator.clipboard.writeText(content)
            toast.success("Copied to clipboard")
        } catch (err) {
            toast.error("Failed to copy")
        }
    }

    const handleCardClick = () => {
        if (isUrl) {
            window.open(content.trim(), '_blank', 'noopener,noreferrer')
        } else if (onClick) {
            onClick();
        } else {
            router.push(`/items/${slug || id}`)
        }
    }

    const targetPath = `/items/${slug || id}`

    return (
        <Card
            className="group flex flex-col h-full overflow-hidden transition-all hover:shadow-md hover:border-primary/50 cursor-pointer bg-background p-0 gap-0"
            onClick={handleCardClick}
            onMouseEnter={() => {
                if (!isUrl && !onClick) router.prefetch(targetPath)
            }}
        >
            {/* Minimal Toolbar Header */}
            <div className="flex items-center justify-between border-b bg-background h-[30px] shrink-0 gap-2">
                {/* Drag Handle */}
                <div
                    {...dragHandleProps}
                    className="flex items-center h-full pl-2 text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing transition-colors touch-none shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                {/* Editable Title */}
                <input
                    value={title}
                    onChange={handleTitleChange}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent border-none outline-none h-full text-xs font-semibold text-foreground/70 hover:text-foreground focus:text-foreground transition-colors placeholder:text-muted-foreground/50 truncate"
                    placeholder="Name"
                />

                <div
                    className="flex items-center h-full shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-full w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-none"
                        onClick={handleCopy}
                        title="Copy to clipboard"
                    >
                        <Copy className="h-[14px] w-[14px]" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-full w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-none"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClick) {
                                onClick();
                            } else {
                                router.push(`/items/${slug || id}`);
                            }
                        }}
                        title="Edit Item"
                    >
                        <Pencil className="h-[14px] w-[14px]" />
                    </Button>

                    <ItemDeleteButton id={id} />
                </div>
            </div>

            {/* Content Area */}
            <CardContent className="p-3 flex-1 overflow-hidden">
                <div className={`text-sm font-sans break-words leading-relaxed line-clamp-4 ${isUrl ? 'underline text-foreground hover:opacity-70 transition-opacity' : 'text-card-foreground group-hover:text-foreground'} whitespace-pre-wrap`}>
                    {content}
                </div>
            </CardContent>
        </Card>
    )
}
