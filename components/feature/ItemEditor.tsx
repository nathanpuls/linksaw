"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ItemCopyButton } from "@/components/feature/ItemCopyButton"
import { ItemDeleteButton } from "@/components/feature/ItemDeleteButton"
import { updateItem } from "@/actions/items"
import { Check, ChevronLeft, Loader2, Cloud } from "lucide-react"
import Link from "next/link"
import { useRef, useEffect, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useDebouncedCallback } from "use-debounce"

interface ItemEditorProps {
    snippet: {
        id: string
        title: string
        content: string
        language: string
        slug?: string
        alias?: string | null
    }
    username?: string
    readOnly?: boolean
    onClose?: () => void
}

export function ItemEditor({ snippet, username, readOnly = false, onClose }: ItemEditorProps) {
    const router = useRouter();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const displayTitle = (snippet.title === 'Untitled Item' || snippet.title === 'Untitled') ? '' : snippet.title
    const [title, setTitle] = useState(displayTitle);
    const [content, setContent] = useState(snippet.content);
    const [alias, setAlias] = useState(snippet.alias || '');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    // Sync state with props when server-side data refreshes (Realtime)
    useEffect(() => {
        router.prefetch('/')
        setTitle((snippet.title === 'Untitled Item' || snippet.title === 'Untitled') ? '' : snippet.title);
        setContent(snippet.content);
        setAlias(snippet.alias || '');
    }, [snippet.title, snippet.content, snippet.alias, router]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    const debouncedUpdate = useDebouncedCallback(async (newContent: string, newAlias: string, newTitle: string) => {
        if (readOnly) return;
        setSaveStatus('saving');
        const formData = new FormData();
        formData.append('title', newTitle || 'Untitled');
        formData.append('language', snippet.language || 'text');
        formData.append('content', newContent);
        formData.append('alias', newAlias); // Send alias

        try {
            await updateItem(snippet.id, formData, snippet.slug);
            setSaveStatus('saved');
        } catch (err) {
            toast.error("Failed to auto-save");
        }
    }, 1000);

    // Flush pending saves on unmount (e.g. clicking outside modal)
    useEffect(() => {
        return () => {
            debouncedUpdate.flush();
        }
    }, [debouncedUpdate]);

    // Listen for Escape key to go back
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (onClose) {
                    onClose();
                } else {
                    router.push('/')
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [router, onClose])

    const handleBack = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onClose) {
            onClose();
        } else {
            router.push('/');
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (readOnly) return;
        const newValue = e.target.value;
        setContent(newValue);
        debouncedUpdate(newValue, alias, title);
    };

    const handleAliasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (readOnly) return;
        const newAlias = e.target.value;
        setAlias(newAlias);
        // Sync title with alias to keep them matching and hide the redundant title heading
        setTitle(newAlias);
        debouncedUpdate(content, newAlias, newAlias);
    }

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (readOnly) return;
        const newTitle = e.target.value;
        setTitle(newTitle);
        debouncedUpdate(content, alias, newTitle);
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b bg-card/30 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center relative">
                    <Link href="/" onClick={handleBack} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group/back z-10 relative">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                        <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded opacity-50 group-hover/back:opacity-100 transition-opacity">Esc</span>
                    </Link>

                    {/* Centered URL / Alias Display */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 max-w-[50%] justify-center">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono overflow-hidden select-none bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
                            <ItemCopyButton
                                content={`https://linksaw.com/@${username || 'user'}/${alias || snippet.slug}`}
                                className="text-muted-foreground/60 hover:text-foreground transition-colors h-3.5 w-3.5"
                            />
                            <div className="flex items-center gap-0.5 min-w-0">
                                <span className="shrink-0 text-muted-foreground/60 hidden sm:inline">linksaw.com/@{username || 'user'}/</span>
                                <div className="relative min-w-[20px] max-w-[150px]">
                                    {readOnly ? (
                                        <span className="text-foreground truncate block">{alias || snippet.slug}</span>
                                    ) : (
                                        <input
                                            value={alias}
                                            onChange={handleAliasChange}
                                            placeholder={snippet.slug || "alias"}
                                            className="bg-transparent border-none outline-none text-foreground w-full placeholder:text-muted-foreground/30 transition-colors p-0 text-center sm:text-left focus:ring-0 truncate"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {!readOnly && (
                        <div className="flex items-center gap-3 z-10 relative">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground transition-opacity duration-500 mr-2">
                                {saveStatus === 'saving' ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span className="hidden sm:inline">Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Cloud className="h-3 w-3" />
                                        <span className="hidden sm:inline">Saved</span>
                                    </>
                                )}
                            </div>

                            <div className="h-4 w-[1px] bg-border mx-1" />

                            <ItemCopyButton content={content} type="button" className="text-muted-foreground hover:text-foreground h-8 w-8" />
                            <ItemDeleteButton id={snippet.id} redirectAfterDelete={true} className="text-muted-foreground hover:text-destructive h-8 w-8" />
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl pb-32">

                <div className="flex items-start gap-2 h-full">
                    {/* Content (Middle) - Editable Textarea */}
                    <div className="flex-grow min-w-0">
                        {/* Hide title if it matches the alias or slug (case-insensitive) to avoid redundancy */}
                        {title.trim().toLowerCase() !== (alias || snippet.alias || '').trim().toLowerCase() && (
                            <input
                                value={title}
                                onChange={handleTitleChange}
                                readOnly={readOnly}
                                placeholder="Untitled Item"
                                className="w-full bg-transparent border-none outline-none pt-4 px-0 text-lg font-bold text-foreground placeholder:text-muted-foreground/30 focus:ring-0"
                            />
                        )}
                        <Textarea
                            ref={textareaRef}
                            name="content"
                            value={content}
                            onChange={handleChange}
                            readOnly={readOnly}
                            className={`min-h-[200px] w-full resize-none border-none shadow-none pb-4 pt-3 text-sm md:text-base font-sans leading-relaxed bg-transparent focus-visible:ring-0 px-0 ${readOnly ? 'cursor-text' : ''}`}
                            placeholder="Type your item..."
                        />
                    </div>
                </div>
            </main>
        </div>
    )
}
