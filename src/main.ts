// Define a global type for the Toast UI Editor
declare global {
    interface Window {
        toastui: {
            Editor: any;
        };
    }
}

// Export an empty object to ensure this file is treated as a module
export {};

const enableFilter = true;
const MAX_RETRIES = 10; // Maximum number of retries to wait for Toast UI
let retryCount = 0;
let timeoutId: number | null = null;

/**
 * Helper function to check if an element is visible
 */
function isElementVisible(element: HTMLElement): boolean {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) &&
        window.getComputedStyle(element).display !== 'none';
}

/**
 * Find the closest ancestor that matches a selector
 */
function findClosest(element: HTMLElement, selector: string): HTMLElement | null {
    let currentElement = element;
    while (currentElement && !currentElement.matches(selector)) {
        currentElement = currentElement.parentElement as HTMLElement;
        if (!currentElement) {
            return null;
        }
    }
    return currentElement;
}

function whenElementAppear(): void {
    if (retryCount >= MAX_RETRIES) {
        console.error("Failed to load Toast UI Editor after multiple retries");
        return;
    }

    // Get all textareas in the container
    const textareas = document.querySelectorAll('.we-ta-container textarea');
    
    // Find a visible textarea
    let visibleTextarea: HTMLTextAreaElement | null = null;
    for (let i = 0; i < textareas.length; i++) {
        if (isElementVisible(textareas[i] as HTMLTextAreaElement)) {
            visibleTextarea = textareas[i] as HTMLTextAreaElement;
            break;
        }
    }
    
    // Only proceed if a visible textarea is found
    if (visibleTextarea) {
        const content = visibleTextarea.value;
        
        // Hide preview container
        const previewContainer = document.querySelector('.wiki-editor .we-text-preview-container');
        if (previewContainer) {
            (previewContainer as HTMLElement).style.display = 'none';
        }
        
        // Create and append the editor container
        const wikiEditor = document.querySelector('.wiki-editor');
        if (wikiEditor) {
            let editorDiv = document.querySelector('#new-editor');
            if (!editorDiv) {
                editorDiv = document.createElement('div');
                editorDiv.id = 'new-editor';
                wikiEditor.appendChild(editorDiv);
            }
        }
        
        // Find the form that contains our textarea
        const form = findClosest(visibleTextarea, 'form');
        const textarea = visibleTextarea;
        
        // Check if Toast UI Editor is available globally
        if (!window.toastui || !window.toastui.Editor) {
            console.warn(`Waiting for Toast UI Editor to load (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            retryCount++;
            timeoutId = window.setTimeout(whenElementAppear, 500);
            return;
        }
        
        // Toast UI is loaded, clean up the timeout and observer
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (window.editorObserver) {
            window.editorObserver.disconnect();
            delete window.editorObserver;
        }

        // Create a custom renderer for special text
        const customRenderer = {
            text(node: any) {
                const text = node.literal || '';
                if (text === '[[_TOC_]]' || text === '[[_TOSP_]]') {
                    return [{
                        type: 'openTag',
                        tagName: 'span',
                        attributes: { class: 'toc-marker' }
                    }, {
                        type: 'text',
                        content: text
                    }, {
                        type: 'closeTag',
                        tagName: 'span'
                    }];
                }
                // Match complete @ mention pattern
                if (/@[a-zA-Z0-9._-]+/.test(text)) {
                    return [{
                        type: 'openTag',
                        tagName: 'span',
                        attributes: { class: 'mention' }
                    }, {
                        type: 'text',
                        content: text
                    }, {
                        type: 'closeTag',
                        tagName: 'span'
                    }];
                }
                return null;
            }
        };

        try {
            // Initialize the editor with the global constructor
            const editor = new window.toastui.Editor({
                el: document.querySelector('#new-editor') as HTMLElement,
                height: 'auto',
                initialEditType: 'wysiwyg',
                previewStyle: 'vertical',
                initialValue: content,
                events: {
                    change: () => {
                        // Get current content and fix special markers
                        const currentContent = editor.getMarkdown()
                            .replace(/\[\[\*TOC\*\]\]/g, '[[_TOC_]]')
                            .replace(/\[\[\*TOSP\*\]\]/g, '[[_TOSP_]]')
                            .replace(/@([a-zA-Z0-9._-]+)/g, (match: string) => match);
                        
                        // Update textarea and trigger events for Azure DevOps to detect the change
                        textarea.value = currentContent;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                },
                customHTMLRenderer: customRenderer,
                toolbarItems: [
                    ['heading', 'bold', 'italic', 'strike'],
                    ['hr', 'quote'],
                    ['ul', 'ol', 'task', 'indent', 'outdent'],
                    ['table', 'link'],
                    ['code', 'codeblock']
                ]
            });

            // Handle form submission
            if (form) {
                form.addEventListener('submit', function() {
                    // Get current content and fix special markers
                    const currentContent = editor.getMarkdown()
                        .replace(/\[\[\*TOC\*\]\]/g, '[[_TOC_]]')
                        .replace(/\[\[\*TOSP\*\]\]/g, '[[_TOSP_]]')
                        .replace(/@([a-zA-Z0-9._-]+)/g, (match: string) => match);
                    
                    // Update textarea value before form submission
                    textarea.value = currentContent;
                });
            }
        } catch (error) {
            console.error("Failed to initialize Toast UI Editor:", error);
            // Don't retry on initialization error
            return;
        }
    } else {
        // No visible textarea, schedule next check
        timeoutId = window.setTimeout(whenElementAppear, 500);
    }
}

// Use MutationObserver for better performance
function observeDOM(): void {
    // Store the observer globally so we can disconnect it later
    window.editorObserver = new MutationObserver((mutations) => {
        // Only call whenElementAppear if we haven't exceeded retries
        if (retryCount < MAX_RETRIES) {
            whenElementAppear();
        }
    });
    
    window.editorObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Also check immediately
    whenElementAppear();
}

// Add type definition for our global additions
declare global {
    interface Window {
        editorObserver?: MutationObserver;
    }
}

// Initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeDOM);
} else {
    // Document already loaded, run immediately
    observeDOM();
}