import { supabase } from './lib/supabase';

console.log('linksaw background script initialized');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('Background received message:', message.type);

    if (message.type === 'CLIPBOARD_COPY') {
        const { content, url } = message;
        console.log('Attempting to save clipboard content to Supabase:', content.substring(0, 20) + '...');

        saveToClipboardHistory(content, url)
            .then(() => {
                console.log('Successfully saved to Supabase');
                sendResponse({ success: true });
            })
            .catch((err) => {
                console.error('Failed to save to Supabase:', err);
                sendResponse({ success: false, error: err.message });
            });

        return true; // Keep channel open for async response
    }
});

async function saveToClipboardHistory(content: string, url: string) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const slug = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { error } = await supabase
        .from('items')
        .insert({
            content,
            source_url: url,
            type: 'clip',
            title: content.slice(0, 30) || 'Clipboard Item',
            language: 'text',
            slug
        });

    if (error) {
        throw error;
    }
}
