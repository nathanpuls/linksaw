"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ItemCopyButton } from "@/components/feature/ItemCopyButton"
import { ItemDeleteButton } from "@/components/feature/ItemDeleteButton"
import { updateItem, createItemJson } from "@/actions/items"
import { Check, ChevronLeft, Loader2, Cloud } from "lucide-react"
import Link from "next/link"
import { useRef, useEffect, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useDebouncedCallback } from "use-debounce"
import { cn } from "@/lib/utils"

interface ItemEditorProps {
    snippet?: {
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
    onCreated?: (item: any) => void
    initialContent?: string
    initialTitle?: string
}

export function ItemEditor({ snippet, username, readOnly = false, onClose, onCreated, initialContent = '', initialTitle = '' }: ItemEditorProps) {
    const router = useRouter();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initialize state
    // If snippet exists, use it. Otherwise use initial values (creation mode)
    const [id, setId] = useState<string | null>(snippet?.id || null);
    const [slug, setSlug] = useState<string | undefined>(snippet?.slug);

    const displayTitle = (snippet?.title === 'Untitled Item' || snippet?.title === 'Untitled' || (!snippet && !initialTitle)) ? '' : (snippet?.title || initialTitle)
    const [title, setTitle] = useState(displayTitle);
    const [content, setContent] = useState(snippet?.content || initialContent);
    const [alias, setAlias] = useState(snippet?.alias || '');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    // Sync state with props when server-side data refreshes (Realtime), ONLY if we have a snippet
    useEffect(() => {
        router.prefetch('/')
        if (snippet && snippet.id === id) {
            setTitle((snippet.title === 'Untitled Item' || snippet.title === 'Untitled') ? '' : snippet.title);
            setContent(snippet.content);
            setAlias(snippet.alias || '');
        }
    }, [snippet, id, router]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    // Focus on mount (for both create and edit modes)
    useEffect(() => {
        if (!readOnly) {
            // Small timeout to ensure modal is fully rendered/focused
            const timer = setTimeout(() => {
                textareaRef.current?.focus();
                // Optional: move cursor to end of text
                if (textareaRef.current) {
                    const len = textareaRef.current.value.length;
                    textareaRef.current.setSelectionRange(len, len);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [readOnly]);

    const debouncedUpdate = useDebouncedCallback(async (newContent: string, newAlias: string, newTitle: string) => {
        if (readOnly) return;
        setSaveStatus('saving');

        const finalTitle = newTitle || 'Untitled';
        const formData = new FormData();
        formData.append('title', finalTitle);
        formData.append('language', 'text');
        formData.append('content', newContent);
        if (newAlias) formData.append('alias', newAlias); // Send alias

        try {
            if (id) {
                // Update existing
                await updateItem(id, formData, slug);
                setSaveStatus('saved');
            } else {
                // Create new
                const newItem = await createItemJson(formData);
                if (newItem) {
                    setId(newItem.id);
                    setSlug(newItem.slug);
                    setSaveStatus('saved');
                    if (onCreated) onCreated(newItem);
                    // Optionally update URL without full reload? 
                    // router.replace(`/items/${newItem.slug}`); 
                    // But we want to stay in the unified editor state.
                }
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || (id ? "Failed to auto-save" : "Failed to create item"));
            setSaveStatus('unsaved');
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

    // Determine what to show in header for URL
    const displaySlug = slug || 'new-item';

    return (
        <div className={cn("min-h-screen flex flex-col", readOnly ? "bg-white text-black" : "bg-background text-foreground")}>
            <header className={cn("sticky top-0 z-50", readOnly ? "bg-white" : "border-b bg-card/30 backdrop-blur-sm")}>
                <div className="container mx-auto px-4 py-4 flex justify-between items-center relative gap-4">
                    {/* Top Left: linksaw brand / Copy content icon */}
                    <div className="flex items-center gap-4 z-10 relative">
                        {readOnly ? (
                            <Link href="/" className="text-sm font-bold tracking-tight hover:opacity-70 transition-opacity">
                                linksaw
                            </Link>
                        ) : (
                            <ItemCopyButton
                                content={content}
                                type="button"
                                className="text-muted-foreground hover:text-foreground h-8 w-8 transition-colors"
                            />
                        )}
                    </div>

                    {/* Centered URL / Alias Display (Only in non-readonly or refined for readonly) */}
                    <div className="flex-1 flex items-center justify-center min-w-0">
                        {!readOnly && (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-sans overflow-hidden select-none bg-muted/30 px-3 py-1.5 rounded-full border border-border/50 max-w-full">
                                {id ? (
                                    <ItemCopyButton
                                        content={`https://linksaw.com/@${username || 'user'}/${alias || displaySlug}`}
                                        className="text-muted-foreground/60 hover:text-foreground transition-colors h-3.5 w-3.5 shrink-0"
                                    />
                                ) : (
                                    <Cloud className="h-3.5 w-3.5 text-muted-foreground/30 animate-pulse shrink-0" />
                                )}
                                <div className="flex items-center gap-0.5 min-w-0">
                                    <span className="shrink-0 text-muted-foreground/60 hidden sm:inline">linksaw.com/@{username || 'user'}/</span>
                                    <div className="relative min-w-[20px] max-w-[150px]">
                                        <input
                                            value={alias}
                                            onChange={handleAliasChange}
                                            placeholder={displaySlug || "alias"}
                                            className="bg-transparent border-none outline-none text-foreground w-full placeholder:text-muted-foreground/30 transition-colors p-0 text-center sm:text-left focus:ring-0 truncate font-sans"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Top Right: Done / Copy + Context Display */}
                    <div className="flex items-center gap-4 z-10 relative">
                        {readOnly ? (
                            <div className="flex items-center gap-3">
                                <div className="text-xs font-sans text-muted-foreground/60">
                                    {username}/{alias || displaySlug}
                                </div>
                                <ItemCopyButton
                                    content={content}
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground h-8 w-8 transition-colors"
                                />
                            </div>
                        ) : (
                            <>
                                {id && (
                                    <ItemDeleteButton id={id} redirectAfterDelete={true} className="text-muted-foreground hover:text-destructive h-8 w-8" />
                                )}
                                <Link
                                    href="/"
                                    onClick={handleBack}
                                    className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity whitespace-nowrap px-1"
                                >
                                    Done
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main
                className="flex-1 container mx-auto px-4 py-4 max-w-4xl pb-32 cursor-text"
                onClick={(e) => {
                    // Focus if clicking the background container
                    if (e.target !== textareaRef.current) {
                        textareaRef.current?.focus();
                    }
                }}
            >

                <div className="flex items-start gap-2 h-full">
                    {/* Content (Middle) - Editable Textarea */}
                    <div className="flex-grow min-w-0">
                        {/* Hide title if it matches the alias or slug (case-insensitive) to avoid redundancy */}
                        {title.trim().toLowerCase() !== (alias || (snippet?.alias || '')).trim().toLowerCase() && (
                            <input
                                value={title}
                                onChange={handleTitleChange}
                                readOnly={readOnly}
                                placeholder="Untitled Item"
                                className="w-full bg-transparent border-none outline-none pt-0 px-0 text-lg font-bold text-foreground placeholder:text-muted-foreground/30 focus:ring-0"
                            />
                        )}
                        <Textarea
                            ref={textareaRef}
                            name="content"
                            value={content}
                            onChange={handleChange}
                            readOnly={readOnly}
                            className={cn(
                                "min-h-[200px] w-full resize-none border-none shadow-none pb-4 pt-0 text-sm md:text-base font-sans leading-relaxed bg-transparent focus-visible:ring-0 px-0",
                                readOnly ? "cursor-text text-foreground/90" : ""
                            )}
                        />
                    </div>
                </div>
            </main>
        </div>
    )
}
