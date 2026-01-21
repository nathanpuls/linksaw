"use client"

import { ItemEditor } from "@/components/feature/ItemEditor";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CreateItemEditorWrapper() {
    const params = useSearchParams();

    // Combine shared title, text (content), and url
    const sharedTitle = params.get('title') || '';
    const sharedText = params.get('content');
    const sharedUrl = params.get('url');

    const initialContent = [
        sharedText,
        sharedUrl
    ].filter(Boolean).join('\n\n');

    return (
        <ItemEditor
            initialTitle={sharedTitle}
            initialContent={initialContent}
        />
    );
}

export default function CreateItemPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        }>
            <CreateItemEditorWrapper />
        </Suspense>
    );
}
