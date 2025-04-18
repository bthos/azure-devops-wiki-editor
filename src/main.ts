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
            const editorDiv = document.createElement('div');
            editorDiv.id = 'new-editor';
            wikiEditor.appendChild(editorDiv);
        }
        
        // Find the form that contains our textarea
        const form = findClosest(visibleTextarea, 'form');
        const textarea = visibleTextarea;
        
        // Check if Toast UI Editor is available globally
        if (!window.toastui || !window.toastui.Editor) {
            console.error("Toast UI Editor is not loaded. Please make sure editor-bundle.js is loaded before main.js");
            return;
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
    }

    // Check again after a delay
    setTimeout(whenElementAppear, 500);
}

// Use MutationObserver for better performance
function observeDOM(): void {
    const observer = new MutationObserver((mutations) => {
        // Check if we need to initialize the editor
        whenElementAppear();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Also check immediately
    whenElementAppear();
}

// Initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeDOM);
} else {
    // Document already loaded, run immediately
    observeDOM();
}