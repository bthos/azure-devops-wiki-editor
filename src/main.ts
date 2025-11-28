// Define a global type for the Toast UI Editor
declare global {
    interface Window {
        toastui: {
            Editor: any;
        };
        editorObserver?: MutationObserver;
        wikiEditorInstance?: any;
    }
}

// Export an empty object to ensure this file is treated as a module
export {};

const MAX_RETRIES = 10; // Maximum number of retries to wait for Toast UI
let retryCount = 0;
let timeoutId: number | null = null;
let editorReady = false;
let isWysiwygMode = false;

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

/**
 * Get the base URL for resolving relative wiki image paths
 * Azure DevOps wiki images are typically stored relative to the wiki root
 */
function getWikiBaseUrl(): string {
    const url = window.location.href;
    
    // Match Azure DevOps wiki URL patterns:
    // https://dev.azure.com/{org}/{project}/_wiki/wikis/{wikiId}/{pagePath}
    // https://{org}.visualstudio.com/{project}/_wiki/wikis/{wikiId}/{pagePath}
    const wikiMatch = url.match(/^(https?:\/\/[^/]+\/[^/]+\/_wiki\/wikis\/[^/]+)/);
    
    if (wikiMatch) {
        return wikiMatch[1];
    }
    
    // Fallback: use the current page's directory
    return url.substring(0, url.lastIndexOf('/'));
}

/**
 * Resolve a relative image URL to an absolute URL
 */
function resolveImageUrl(src: string): string {
    // If already absolute, return as-is
    if (/^https?:\/\//.test(src) || src.startsWith('data:')) {
        return src;
    }
    
    const baseUrl = getWikiBaseUrl();
    
    // Handle .attachments folder (common for Azure DevOps wiki uploads)
    if (src.startsWith('.attachments/') || src.startsWith('/.attachments/')) {
        // Images in .attachments folder are at the wiki root level
        return `${baseUrl}/${src.replace(/^\//, '')}`;
    }
    
    // Handle relative paths
    if (src.startsWith('/')) {
        // Absolute path from wiki root
        return `${baseUrl}${src}`;
    }
    
    // Relative to current page
    return `${baseUrl}/${src}`;
}

/**
 * Create the custom mode toggle switch
 */
function createModeToggle(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'wysiwyg-toggle-container';
    container.innerHTML = `
        <div class="wysiwyg-toggle">
            <span class="toggle-label markdown-label active">Markdown</span>
            <label class="toggle-switch">
                <input type="checkbox" id="wysiwyg-toggle-input">
                <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label wysiwyg-label">WYSIWYG</span>
        </div>
    `;
    return container;
}

/**
 * Get the content from the editor and update the textarea
 */
function syncEditorToTextarea(textarea: HTMLTextAreaElement): void {
    if (window.wikiEditorInstance) {
        let content = window.wikiEditorInstance.getMarkdown();
        
        // Fix TOC markers that may have been escaped
        content = content
            .replace(/\[\[\*TOC\*\]\]/g, '[[_TOC_]]')
            .replace(/\[\[\*TOSP\*\]\]/g, '[[_TOSP_]]')
            .replace(/\\\[\\\[_TOC_\\\]\\\]/g, '[[_TOC_]]')
            .replace(/\\\[\\\[_TOSP_\\\]\\\]/g, '[[_TOSP_]]');
        
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * Switch to WYSIWYG mode
 */
function enableWysiwygMode(textarea: HTMLTextAreaElement, wikiEditor: HTMLElement): void {
    isWysiwygMode = true;
    
    // Hide ADO toolbar (multiple possible selectors)
    const adoToolbar = wikiEditor.querySelector('.we-toolbar-container');
    if (adoToolbar) {
        (adoToolbar as HTMLElement).style.display = 'none';
    }
    
    // Hide the wiki markdown toolbar (wiki-markdown-toolbar bowtie we-toolbar)
    const wikiMarkdownToolbar = document.querySelector('.wiki-markdown-toolbar');
    if (wikiMarkdownToolbar) {
        (wikiMarkdownToolbar as HTMLElement).style.display = 'none';
    }
    
    // Hide ADO preview container
    const previewContainer = wikiEditor.querySelector('.we-text-preview-container');
    if (previewContainer) {
        (previewContainer as HTMLElement).style.display = 'none';
    }
    
    // Hide ADO textarea container
    const taContainer = wikiEditor.querySelector('.we-ta-container');
    if (taContainer) {
        (taContainer as HTMLElement).style.display = 'none';
    }
    
    // Show/create editor
    let editorDiv = document.querySelector('#new-editor') as HTMLElement;
    if (!editorDiv) {
        editorDiv = document.createElement('div');
        editorDiv.id = 'new-editor';
        wikiEditor.appendChild(editorDiv);
    }
    editorDiv.style.display = 'block';
    
    // Initialize editor if not already done
    if (!window.wikiEditorInstance) {
        initializeEditor(textarea, editorDiv);
    } else {
        // Update editor content from textarea
        window.wikiEditorInstance.setMarkdown(textarea.value);
    }
    
    // Update toggle labels
    updateToggleLabels(true);
}

/**
 * Switch to Markdown mode
 */
function disableWysiwygMode(textarea: HTMLTextAreaElement, wikiEditor: HTMLElement): void {
    isWysiwygMode = false;
    
    // Sync content back to textarea
    syncEditorToTextarea(textarea);
    
    // Show ADO toolbar
    const adoToolbar = wikiEditor.querySelector('.we-toolbar-container');
    if (adoToolbar) {
        (adoToolbar as HTMLElement).style.display = '';
    }
    
    // Show the wiki markdown toolbar
    const wikiMarkdownToolbar = document.querySelector('.wiki-markdown-toolbar');
    if (wikiMarkdownToolbar) {
        (wikiMarkdownToolbar as HTMLElement).style.display = '';
    }
    
    // Show ADO preview container
    const previewContainer = wikiEditor.querySelector('.we-text-preview-container');
    if (previewContainer) {
        (previewContainer as HTMLElement).style.display = '';
    }
    
    // Show ADO textarea container
    const taContainer = wikiEditor.querySelector('.we-ta-container');
    if (taContainer) {
        (taContainer as HTMLElement).style.display = '';
    }
    
    // Hide editor
    const editorDiv = document.querySelector('#new-editor');
    if (editorDiv) {
        (editorDiv as HTMLElement).style.display = 'none';
    }
    
    // Update toggle labels
    updateToggleLabels(false);
}

/**
 * Update the toggle label active states
 */
function updateToggleLabels(isWysiwyg: boolean): void {
    const mdLabel = document.querySelector('.toggle-label.markdown-label');
    const wysiwygLabel = document.querySelector('.toggle-label.wysiwyg-label');
    
    if (mdLabel && wysiwygLabel) {
        if (isWysiwyg) {
            mdLabel.classList.remove('active');
            wysiwygLabel.classList.add('active');
        } else {
            mdLabel.classList.add('active');
            wysiwygLabel.classList.remove('active');
        }
    }
}

/**
 * Initialize the Toast UI Editor
 */
function initializeEditor(textarea: HTMLTextAreaElement, editorDiv: HTMLElement): void {
    const form = findClosest(textarea, 'form');
    const content = textarea.value;
    
    // Create custom renderer for special text and images
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
            // Match Azure DevOps @ mention patterns: @<username> or @username
            if (/@<[^>]+>/.test(text) || /@[a-zA-Z0-9._-]+/.test(text)) {
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
        },
        // Preserve HTML-like @ mentions that might be parsed as HTML
        htmlInline(node: any) {
            const html = node.literal || '';
            return [{
                type: 'html',
                content: html
            }];
        },
        // Custom image renderer to handle relative URLs
        image(node: any, context: any) {
            const { destination, title } = node;
            const altText = context.entering ? '' : (node.firstChild?.literal || '');
                
            // Resolve relative URLs to absolute
            const resolvedSrc = resolveImageUrl(destination || '');
            
            if (context.entering) {
                return [{
                    type: 'openTag',
                    tagName: 'img',
                    selfClose: true,
                    attributes: {
                        src: resolvedSrc,
                        alt: altText,
                        ...(title ? { title } : {})
                    }
                }];
            }
            return [];
        }
    };

    try {
        window.wikiEditorInstance = new window.toastui.Editor({
            el: editorDiv,
            height: 'auto',
            initialEditType: 'wysiwyg',
            previewStyle: 'vertical',
            initialValue: content,
            hideModeSwitch: true, // Hide the default mode switch
            events: {
                change: () => {
                    syncEditorToTextarea(textarea);
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
                syncEditorToTextarea(textarea);
            });
        }
    } catch (error) {
        console.error("Failed to initialize Toast UI Editor:", error);
    }
}

/**
 * Setup the toggle and wait for Toast UI to load
 */
function setupEditor(): void {
    if (editorReady) {
        return;
    }

    if (retryCount >= MAX_RETRIES) {
        console.error("Failed to load Toast UI Editor after multiple retries");
        return;
    }

    // Find visible textarea
    const textareas = document.querySelectorAll('.we-ta-container textarea');
    let visibleTextarea: HTMLTextAreaElement | null = null;
    
    for (let i = 0; i < textareas.length; i++) {
        if (isElementVisible(textareas[i] as HTMLTextAreaElement)) {
            visibleTextarea = textareas[i] as HTMLTextAreaElement;
            break;
        }
    }
    
    if (!visibleTextarea) {
        timeoutId = window.setTimeout(setupEditor, 500);
        return;
    }
    
    // Check if Toast UI Editor is available
    if (!window.toastui || !window.toastui.Editor) {
        console.warn(`Waiting for Toast UI Editor to load (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        retryCount++;
        timeoutId = window.setTimeout(setupEditor, 500);
        return;
    }
    
    // Mark as ready
    editorReady = true;
    
    // Clean up
    if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
    }
    if (window.editorObserver) {
        window.editorObserver.disconnect();
        delete window.editorObserver;
    }
    
    const wikiEditor = document.querySelector('.wiki-editor') as HTMLElement;
    if (!wikiEditor) {
        return;
    }
    
    const textarea = visibleTextarea;
    
    // Check if toggle already exists
    if (document.querySelector('#wysiwyg-toggle-container')) {
        return;
    }
    
    // Create and insert toggle at the top of the wiki editor
    const toggle = createModeToggle();
    wikiEditor.insertBefore(toggle, wikiEditor.firstChild);
    
    // Setup toggle event listener
    const toggleInput = document.querySelector('#wysiwyg-toggle-input') as HTMLInputElement;
    if (toggleInput) {
        toggleInput.addEventListener('change', function() {
            if (this.checked) {
                enableWysiwygMode(textarea, wikiEditor);
            } else {
                disableWysiwygMode(textarea, wikiEditor);
            }
        });
    }
}

// Use MutationObserver for better performance
function observeDOM(): void {
    window.editorObserver = new MutationObserver(() => {
        if (retryCount < MAX_RETRIES && !editorReady) {
            setupEditor();
        }
    });
    
    window.editorObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    setupEditor();
}

// Initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeDOM);
} else {
    // Document already loaded, run immediately
    observeDOM();
}
