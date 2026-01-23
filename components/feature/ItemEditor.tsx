"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ItemCopyButton } from "@/components/feature/ItemCopyButton"
import { ItemDeleteButton } from "@/components/feature/ItemDeleteButton"
import { updateItem, createItemJson } from "@/actions/items"
import { Check, ChevronLeft, Loader2, Cloud, Link2, Eye, FileText } from "lucide-react"
import Link from "next/link"
import React, { useRef, useEffect, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useDebouncedCallback } from "use-debounce"
import { cn } from "@/lib/utils"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { LinkifiedText } from "@/lib/linkify"

const markdownComponents = {
    p: ({ children }: any) => (
        <p>
            {React.Children.map(children, child =>
                typeof child === 'string' ? <LinkifiedText text={child} /> : child
            )}
        </p>
    ),
    li: ({ children }: any) => (
        <li>
            {React.Children.map(children, child =>
                typeof child === 'string' ? <LinkifiedText text={child} /> : child
            )}
        </li>
    ),
    td: ({ children }: any) => (
        <td>
            {React.Children.map(children, child =>
                typeof child === 'string' ? <LinkifiedText text={child} /> : child
            )}
        </td>
    ),
    h1: ({ children }: any) => <h1>{React.Children.map(children, child => typeof child === 'string' ? <LinkifiedText text={child} /> : child)}</h1>,
    h2: ({ children }: any) => <h2>{React.Children.map(children, child => typeof child === 'string' ? <LinkifiedText text={child} /> : child)}</h2>,
    h3: ({ children }: any) => <h3>{React.Children.map(children, child => typeof child === 'string' ? <LinkifiedText text={child} /> : child)}</h3>,
    blockquote: ({ children }: any) => <blockquote>{React.Children.map(children, child => typeof child === 'string' ? <LinkifiedText text={child} /> : child)}</blockquote>,
    a: ({ children, href }: any) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-black dark:text-white underline hover:opacity-70 transition-opacity font-medium"
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </a>
    ),
};

interface ItemEditorProps {
    snippet?: {
        id: string
        title: string
        content: string
        language?: string
        slug?: string
        alias?: string | null
    }
    username?: string
    displayName?: string
    readOnly?: boolean
    onClose?: () => void
    onCreated?: (item: any) => void
    initialContent?: string
    initialTitle?: string
    renderMarkdown?: boolean
}

export function ItemEditor({ snippet, username, displayName, readOnly = false, onClose, onCreated, initialContent = '', initialTitle = '', renderMarkdown = false }: ItemEditorProps) {
    const router = useRouter();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initialize state
    // If snippet exists, use it. Otherwise use initial values (creation mode)
    const [id, setId] = useState<string | null>(snippet?.id || null);
    const [slug, setSlug] = useState<string | undefined>(snippet?.slug);

    const displayTitle = (snippet?.title === 'Untitled Item' || snippet?.title === 'Untitled' || (!snippet && !initialTitle)) ? '' : (snippet?.title || initialTitle)
    const [title, setTitle] = useState(displayTitle || '');
    const [content, setContent] = useState(snippet?.content || initialContent);
    const [alias, setAlias] = useState(snippet?.alias || '');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [previewMode, setPreviewMode] = useState(!!snippet);

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
                    {/* Top Left: Logo & Display Name */}
                    <div className="flex items-center gap-1.5 z-10 relative">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
                            <div className="relative w-6 h-6 rounded-full overflow-hidden">
                                <img
                                    src="/logo.svg"
                                    alt="Logo"
                                    className="object-cover"
                                />
                            </div>
                        </Link>
                        {username && (
                            <span className="text-[13px] font-semibold text-muted-foreground/50 ml-1">
                                @{username}
                            </span>
                        )}
                        {(alias || displaySlug) && (
                            <>
                                <span className="text-muted-foreground/30 text-[13px] font-medium mx-0.5">/</span>
                                <span className="text-[13px] font-semibold text-foreground">
                                    {alias || displaySlug}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Centered URL / Alias Display (Only in non-readonly or refined for readonly) */}
                    <div className="flex-1 flex items-center justify-center min-w-0">
                        {!readOnly && (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-sans overflow-hidden select-none bg-muted/30 px-3 py-1.5 rounded-full border border-border/50 max-w-full">
                                {id ? (
                                    <ItemCopyButton
                                        content={`https://linksaw.com/${username || 'user'}/${alias || displaySlug}`}
                                        className="text-muted-foreground/60 hover:text-foreground transition-colors h-3.5 w-3.5 shrink-0"
                                    />
                                ) : (
                                    <Cloud className="h-3.5 w-3.5 text-muted-foreground/30 animate-pulse shrink-0" />
                                )}
                                <div className="flex items-center gap-0.5 min-w-0">
                                    <span className="shrink-0 text-muted-foreground/60 hidden sm:inline">linksaw.com/{username || 'user'}/</span>
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

                    {/* Top Right: Actions (Copy Link, Copy Content, Delete, Done) */}
                    <div className="flex items-center gap-2 z-10 relative">
                        {id && !readOnly && (
                            <div className="flex items-center bg-muted/50 rounded-lg p-0.5 mr-2">
                                <Button
                                    variant={previewMode ? "ghost" : "secondary"}
                                    size="sm"
                                    onClick={() => setPreviewMode(false)}
                                    className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider gap-1.5"
                                >
                                    <FileText className="h-3 w-3" />
                                    Edit
                                </Button>
                                <Button
                                    variant={previewMode ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setPreviewMode(true)}
                                    className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider gap-1.5"
                                >
                                    <Eye className="h-3 w-3" />
                                    View
                                </Button>
                            </div>
                        )}
                        {/* Copy Link Button */}
                        <ItemCopyButton
                            content={`https://linksaw.com/${username || 'user'}/${alias || displaySlug}`}
                            className="text-muted-foreground hover:text-foreground h-8 w-8 transition-colors"
                            title="Copy Public Link"
                        >
                            <Link2 className="h-4 w-4" />
                        </ItemCopyButton>

                        {/* Copy Content Button */}
                        <ItemCopyButton
                            content={content}
                            className="text-muted-foreground hover:text-foreground h-8 w-8 transition-colors"
                            title="Copy Content"
                        />

                        {readOnly ? null : (
                            <>
                                <div className="h-4 w-px bg-border mx-1" />
                                {id && (
                                    <ItemDeleteButton id={id} redirectAfterDelete={true} className="text-muted-foreground hover:text-destructive h-8 w-8" />
                                )}
                                <Link
                                    href="/"
                                    onClick={handleBack}
                                    className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity whitespace-nowrap px-2"
                                >
                                    Done
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main
                className={cn("flex-1 container mx-auto px-4 py-4 max-w-4xl pb-32", readOnly ? "cursor-default" : "cursor-text")}
                onClick={(e) => {
                    // Focus if clicking the background container
                    if (!readOnly && e.target !== textareaRef.current) {
                        textareaRef.current?.focus();
                    }
                }}
            >

                <div className="flex items-start gap-2 h-full">
                    {/* Content (Middle) - Editable Textarea */}
                    <div className="flex-grow min-w-0">
                        {/* Hide title if it matches the alias or slug (case-insensitive) or is default name */}
                        {(title && title !== 'Untitled' && title !== 'Untitled Item' &&
                            title.trim().toLowerCase() !== (alias || (snippet?.alias || '')).trim().toLowerCase()) && (
                                <input
                                    value={title}
                                    onChange={handleTitleChange}
                                    readOnly={readOnly}
                                    placeholder="Add a title..."
                                    className="w-full bg-transparent border-none outline-none pt-0 px-0 text-lg font-bold text-foreground placeholder:text-muted-foreground/30 focus:ring-0 mb-4"
                                />
                            )}
                        {previewMode ? (
                            <div
                                className="prose prose-sm md:prose-base dark:prose-invert max-w-none pt-0 focus:outline-none whitespace-pre-wrap"
                                onClick={() => !readOnly && setPreviewMode(false)}
                            >
                                {renderMarkdown ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkBreaks]}
                                        components={markdownComponents as any}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                ) : (
                                    <LinkifiedText text={content} />
                                )}
                            </div>
                        ) : (
                            <Textarea
                                ref={textareaRef}
                                name="content"
                                value={content}
                                onChange={handleChange}
                                readOnly={readOnly}
                                className={cn(
                                    "min-h-[200px] w-full resize-none border-none shadow-none pb-4 pt-0 text-sm md:text-base font-sans leading-relaxed bg-transparent focus-visible:ring-0 px-0",
                                    readOnly ? "cursor-default text-foreground/90" : ""
                                )}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
