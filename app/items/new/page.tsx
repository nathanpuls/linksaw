"use client"

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createItem } from "@/actions/items";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CreateItemForm() {
    const formRef = useRef<HTMLFormElement>(null);
    const params = useSearchParams();

    // Combine shared title, text (content), and url
    const sharedTitle = params.get('title');
    const sharedText = params.get('content'); // 'text' in manifest maps to 'content' here
    const sharedUrl = params.get('url');

    const initialContent = [
        sharedTitle,
        sharedText,
        sharedUrl
    ].filter(Boolean).join('\n\n');

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();

    useEffect(() => {
        // Prefetch dashboard for fast ESC navigation
        router.prefetch('/');

        // Force focus on mount
        textareaRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                formRef.current?.requestSubmit();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                router.push('/');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b bg-card/30 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-4 flex items-center gap-2">
                    <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Cancel
                    </Link>
                    <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 bg-muted/50 hidden md:inline-block">Esc</span>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-3xl flex-1 flex flex-col">
                <form ref={formRef} action={createItem} className="space-y-6 flex-1 flex flex-col">
                    <div className="flex-1">
                        <Textarea
                            ref={textareaRef}
                            id="content"
                            name="content"
                            className="min-h-[400px] h-full text-lg border-none focus-visible:ring-0 shadow-none resize-none p-0 bg-transparent placeholder:text-muted-foreground/50 focus-visible:ring-offset-0 font-sans"
                            placeholder="Type or paste your item here..."
                            defaultValue={initialContent}
                            required
                        />
                    </div>
                    {/* Desktop Save Button */}
                    <div className="hidden md:flex justify-end items-center gap-4 pb-8">
                        <Button type="submit" className="bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 relative pr-20">
                            Save
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-100">
                                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 font-mono text-[10px] font-medium opacity-100 text-current">
                                    <span className="text-xs">⌘</span>Enter
                                </kbd>
                            </span>
                        </Button>
                    </div>

                    {/* Mobile Floating Action Button (Save) */}
                    <div className="md:hidden fixed bottom-6 right-6 z-50">
                        <Button type="submit" size="icon" className="h-14 w-14 rounded-full bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black shadow-lg">
                            <Check className="h-6 w-6" />
                            <span className="sr-only">Save Item</span>
                        </Button>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default function CreateItemPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        }>
            <CreateItemForm />
        </Suspense>
    );
}
