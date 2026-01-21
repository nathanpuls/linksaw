"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Pencil, GripVertical, Check, Circle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { ItemDeleteButton } from "./ItemDeleteButton"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useDebouncedCallback } from "use-debounce"
import { updateItem } from "@/actions/items"
import { cn } from "@/lib/utils"

interface ItemCardProps {
    id: string
    title: string
    content: string
    language?: string
    slug?: string
    onClick?: () => void
    isSelected?: boolean
    onSelect?: (selected: boolean) => void
    onDelete?: () => void
    isReadOnly?: boolean
}

export function ItemCard({
    id,
    title: initialTitle,
    content,
    language,
    slug,
    onClick,
    dragHandleProps,
    isSelected = false,
    onSelect,
    onDelete,
    isReadOnly = false
}: ItemCardProps & { dragHandleProps?: any }) {
    const router = useRouter()
    // If title is explicitly 'Untitled Item' (legacy default) or just 'Untitled', treat as empty for UX
    const displayTitle = (initialTitle === 'Untitled Item' || initialTitle === 'Untitled') ? '' : initialTitle
    const [title, setTitle] = useState(displayTitle)
    const [copied, setCopied] = useState(false)

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
        } catch (err: any) {
            toast.error(err.message || "Failed to update title")
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
            setCopied(true)
            toast.success("Copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
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
            <div
                className={cn(
                    "flex items-center justify-between border-b bg-background min-h-[38px] shrink-0 gap-2 pl-3 transition-colors",
                    !isReadOnly ? "cursor-grab active:cursor-grabbing touch-none" : "",
                    isSelected && "bg-accent border-primary/20"
                )}
                {...(!isReadOnly ? dragHandleProps : {})}
            >
                {/* Editable Title */}
                <input
                    value={title}
                    onChange={handleTitleChange}
                    onClick={(e) => e.stopPropagation()}
                    readOnly={isReadOnly}
                    className={cn(
                        "flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] font-semibold text-foreground/70 transition-colors truncate p-0 leading-none py-3",
                        !isReadOnly && "hover:text-foreground focus:text-foreground"
                    )}
                />

                <div
                    className={cn(
                        "flex items-center self-stretch shrink-0 transition-opacity cursor-default",
                        (isSelected || isReadOnly) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-full w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-none cursor-pointer"
                        onClick={handleCopy}
                        title="Copy to clipboard"
                    >
                        {copied ? <Check className="h-[14px] w-[14px]" /> : <Copy className="h-[14px] w-[14px]" />}
                    </Button>

                    {!isReadOnly && <ItemDeleteButton id={id} onDelete={onDelete} />}

                    {/* Selection Toggle */}
                    {!isReadOnly && (
                        <div
                            className={cn(
                                "flex items-center h-full cursor-pointer px-2 transition-opacity hover:bg-muted",
                                isSelected ? "opacity-100 bg-primary/10" : "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect?.(!isSelected);
                            }}
                        >
                            {isSelected ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
                            ) : (
                                <Circle className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-foreground transition-colors" />
                            )
                            }
                        </div>
                    )}
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
