import React from 'react'

// Broad phone regex: matches common international and local formats
const PHONE_REGEX = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,9}/g;

// Broad address regex: starts with a number, then street name/details
const ADDRESS_REGEX = /\b\d+\s+[A-Za-z0-9#\s,.]{3,}(?:\s+[A-Z]{2})?(?:\s+\d{5})?\b/g;

// URL regex that catches things like "google.com" without http://
const URL_REGEX = /(?:https?:\/\/|www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;

export function LinkifiedText({ text, className = "" }: { text: string, className?: string }) {
    if (!text) return null;

    // Reset regex positions (important since they are global)
    URL_REGEX.lastIndex = 0;
    PHONE_REGEX.lastIndex = 0;
    ADDRESS_REGEX.lastIndex = 0;

    // Combine all matches into a single sorted list
    const matches: { start: number, end: number, url: number | string, text: string }[] = [];

    // 1. Find URLs
    let match: RegExpExecArray | null;
    while ((match = URL_REGEX.exec(text)) !== null) {
        let url = match[0];
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        matches.push({ start: match.index, end: match.index + match[0].length, url, text: match[0] });
    }

    // 2. Find Phones (only if not already inside a URL match)
    while ((match = PHONE_REGEX.exec(text)) !== null) {
        const index = match.index;
        const currentMatch = match[0];
        const isOverlap = matches.some(m => (index >= m.start && index < m.end));
        if (!isOverlap) {
            const cleanPhone = currentMatch.replace(/[^\d+]/g, '');
            if (cleanPhone.length >= 7) { // Support for shorter local numbers if needed, but safe enough for mobile
                matches.push({
                    start: index,
                    end: index + currentMatch.length,
                    url: `tel:${cleanPhone}`,
                    text: currentMatch
                });
            }
        }
    }

    // 3. Find Addresses (only if not already inside another match)
    while ((match = ADDRESS_REGEX.exec(text)) !== null) {
        const index = match.index;
        const currentMatch = match[0];
        const isOverlap = matches.some(m => (index >= m.start && index < m.end));
        if (!isOverlap) {
            matches.push({
                start: index,
                end: index + currentMatch.length,
                url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentMatch)}`,
                text: currentMatch
            });
        }
    }

    // Sort matches by start index
    matches.sort((a, b) => a.start - b.start);

    // Final result construction
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((m, i) => {
        // Text before match
        if (m.start > lastIndex) {
            elements.push(text.slice(lastIndex, m.start));
        }
        // The link
        elements.push(
            <a
                key={i}
                href={m.url as string}
                target="_blank"
                rel="noopener noreferrer"
                className={className || "text-black dark:text-white underline hover:opacity-70 transition-opacity font-medium"}
                onClick={(e) => e.stopPropagation()}
            >
                {m.text}
            </a>
        );
        lastIndex = m.end;
    });

    // Remaining text
    if (lastIndex < text.length) {
        elements.push(text.slice(lastIndex));
    }

    return <>{elements}</>;
}
