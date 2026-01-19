// Content script to capture copy events
console.log('Snippets content script loaded');

document.addEventListener('copy', () => {
    console.log('Copy event detected on page');

    // Wait for the clipboard to be updated or the selection to be stable
    setTimeout(() => {
        try {
            const selectedText = window.getSelection()?.toString();

            if (selectedText && selectedText.trim() !== '') {
                console.log('Captured selected text:', selectedText.substring(0, 20) + '...');

                chrome.runtime.sendMessage({
                    type: 'CLIPBOARD_COPY',
                    content: selectedText,
                    url: window.location.href
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message to background:', chrome.runtime.lastError);
                    } else {
                        console.log('Background processed copy event:', response);
                    }
                });
            } else {
                console.log('No text selected or selection empty');
            }
        } catch (err) {
            console.error('Failed to capture copy event:', err);
        }
    }, 50); // Faster response
});
