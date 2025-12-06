// Azure DevOps Wiki Editor - Main Content Script
// Uses Milkdown Core for WYSIWYG markdown editing

import { 
    Editor, 
    rootCtx, 
    defaultValueCtx, 
    commonmark,
    gfm,
    history,
    listener,
    listenerCtx,
    clipboard,
    getMarkdown,
    adoTheme,
    detectAdoTheme,
    adoSyntaxPlugin,
    toolbarPlugin
} from './editor-bundle';

// Define global types
declare global {
    interface Window {
        MilkdownEditor: typeof Editor;
        editorObserver?: MutationObserver;
        wikiEditorInstance?: Editor;
    }
}

// Export empty object to ensure this file is treated as a module
export {};

const MAX_RETRIES = 10;
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
 * Create the custom mode toggle switch
 */
function createModeToggle(position: string = 'right'): HTMLElement {
    const container = document.createElement('div');
    container.id = 'wysiwyg-toggle-container';
    container.setAttribute('data-position', position);
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
        // Get markdown content using the action API
        let content = window.wikiEditorInstance.action(getMarkdown());
        
        // Restore ADO markers to original format
        content = postprocessAdoMarkers(content);
        
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
    
    // Hide ADO toolbar
    const adoToolbar = wikiEditor.querySelector('.we-toolbar-container');
    if (adoToolbar) {
        (adoToolbar as HTMLElement).style.display = 'none';
    }
    
    // Hide the wiki markdown toolbar
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
    let editorDiv = document.querySelector('#milkdown-editor') as HTMLElement;
    if (!editorDiv) {
        editorDiv = document.createElement('div');
        editorDiv.id = 'milkdown-editor';
        wikiEditor.appendChild(editorDiv);
    }
    editorDiv.style.display = 'block';
    
    // Destroy existing editor if present
    if (window.wikiEditorInstance) {
        try {
            window.wikiEditorInstance.destroy();
        } catch (e) {
            console.warn('Error destroying editor:', e);
        }
        window.wikiEditorInstance = undefined;
        editorDiv.innerHTML = '';
    }
    
    initializeEditor(textarea, editorDiv);
    
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
    const editorDiv = document.querySelector('#milkdown-editor');
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
 * Postprocess markdown to restore escaped characters
 * The new syntax plugins handle TOC/TOSP parsing directly,
 * so we only need to unescape special characters here.
 */
function postprocessAdoMarkers(content: string): string {
    return content
        // Restore escaped angle brackets: \< → <
        .replace(/\\</g, '<');
}

/**
 * Initialize the Milkdown Core Editor
 */
async function initializeEditor(textarea: HTMLTextAreaElement, editorDiv: HTMLElement): Promise<void> {
    const form = findClosest(textarea, 'form');
    const content = textarea.value;
    
    // Detect current theme
    const currentTheme = detectAdoTheme();
    const isDarkTheme = currentTheme === 'dark' || currentTheme === 'hc-dark';
    
    try {
        // Create Milkdown Core editor with plugins
        const editor = await Editor.make()
            .config(adoTheme)
            .config((ctx) => {
                // Set the root element
                ctx.set(rootCtx, editorDiv);
                
                // Set default content
                ctx.set(defaultValueCtx, content);
                
                // Add markdown listener for syncing to textarea
                ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, _prevMarkdown) => {
                    if (isWysiwygMode) {
                        // Restore ADO markers to original format
                        let processedContent = postprocessAdoMarkers(markdown);
                        textarea.value = processedContent;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            })
            .use(commonmark)
            .use(gfm)
            .use(history)
            .use(listener)
            .use(clipboard)
            .use(adoSyntaxPlugin)
            .use(toolbarPlugin)
            .create();
        
        // Store the editor instance
        window.wikiEditorInstance = editor;
        
        // Apply dark theme class if needed
        if (isDarkTheme) {
            editorDiv.classList.add('milkdown-dark-theme');
        }
        
        // Handle form submission
        if (form) {
            form.addEventListener('submit', function() {
                syncEditorToTextarea(textarea);
            });
        }
        
        console.log('Milkdown Core editor initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Milkdown Core Editor:', error);
    }
}

/**
 * Setup the toggle and wait for Milkdown to load
 */
function setupEditor(): void {
    if (editorReady) {
        return;
    }

    if (retryCount >= MAX_RETRIES) {
        console.error('Failed to setup editor after multiple retries');
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
    
    // Check if Milkdown Editor is available
    if (typeof Editor === 'undefined' && !window.MilkdownEditor) {
        console.warn(`Waiting for Milkdown Editor to load (attempt ${retryCount + 1}/${MAX_RETRIES})`);
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
    
    // Function to create toggle and set up event listener
    function createToggleWithPosition(position: string) {
        // Create and insert toggle at the top of the wiki editor
        const toggle = createModeToggle(position);
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
    
    // Load toggle position setting and create toggle
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['togglePosition'], function(result) {
            const position = result.togglePosition || 'right';
            createToggleWithPosition(position);
        });
    } else {
        // Fallback for non-extension context (playground.html)
        createToggleWithPosition('right');
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
    observeDOM();
}
