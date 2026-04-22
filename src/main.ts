// Azure DevOps Wiki Editor - Main Content Script
// Default WYSIWYG: ProseMirror {@link WikiEditor}; optional Milkdown for comparison (popup / `?milkdown=1`).

import { 
    Editor, 
    rootCtx, 
    defaultValueCtx, 
    remarkStringifyOptionsCtx,
    commonmark,
    gfm,
    history,
    listener,
    listenerCtx,
    clipboard,
    getMarkdown,
    adoTheme,
    isDarkTheme,
    adoSyntaxPlugin,
    toolbarPlugin,
    upload,
    AdoAttachmentService,
    AdoMentionService,
    attachmentServiceCtx,
    configureAttachmentUpload,
    WikiEditor,
} from './editor-bundle';

import { getWikiInfoFromUrl } from './ado-wiki-api';
import { adoHeadingAnchorPlugin } from './plugins/ado-heading-anchor-plugin';
import { attachmentImageResolvePlugin } from './plugins/attachment-image-resolve';
import { setupMentionProfileCard } from './plugins/mention-profile-card';
import { adoWikiAttachmentImageHandler, adoWikiAttachmentLinkHandler } from './syntax/ado-wiki-attachment-stringify';
import { postprocessAdoMarkers, preprocessMentions } from './utils/wiki-markers';
import { WIKI_EDITOR_DARK_CLASS, WIKI_EDITOR_ROOT_ID } from './editor/wiki-editor-dom';

// Define global types
declare global {
    interface Window {
        MilkdownEditor: typeof Editor;
        editorObserver?: MutationObserver;
        /** Active surface: legacy Milkdown {@link Editor} or migration {@link WikiEditor}. */
        wikiEditorInstance?: Editor | WikiEditor;
    }
}

// Export empty object to ensure this file is treated as a module
export {};

const MAX_RETRIES = 10;
let retryCount = 0;
let timeoutId: number | null = null;
let editorReady = false;
let isWysiwygMode = false;
let mentionService: AdoMentionService | null = null;
/** Set in {@link initializeEditor} for {@link syncEditorToTextarea} (attachment URL round-trip). */
let attachmentServiceInstance: AdoAttachmentService | null = null;

const STORAGE_USE_MILKDOWN = 'useMilkdownWikiEditor';

/** Legacy opt-in to ProseMirror; migrated when reading {@link STORAGE_USE_MILKDOWN}. */
const STORAGE_LEGACY_PM = 'useProseMirrorWikiEditor';

/**
 * When false (default), {@link initializeEditor} mounts {@link WikiEditor}.
 * Enable Milkdown for side-by-side comparison via the extension popup or `?milkdown=1` on the wiki URL.
 * `?wikieditor=1` still forces the ProseMirror editor regardless of other flags.
 */
function readUseMilkdownWikiEditor(): Promise<boolean> {
    try {
        const u = new URL(location.href);
        if (u.searchParams.get('wikieditor') === '1') {
            return Promise.resolve(false);
        }
        if (u.searchParams.get('milkdown') === '1') {
            return Promise.resolve(true);
        }
    } catch {
        /* ignore */
    }
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
            resolve(false);
            return;
        }
        chrome.storage.sync.get([STORAGE_USE_MILKDOWN, STORAGE_LEGACY_PM], (r) => {
            if (typeof r[STORAGE_USE_MILKDOWN] === 'boolean') {
                resolve(!!r[STORAGE_USE_MILKDOWN]);
                return;
            }
            if (r[STORAGE_LEGACY_PM] === true) {
                resolve(false);
                return;
            }
            if (r[STORAGE_LEGACY_PM] === false) {
                resolve(true);
                return;
            }
            resolve(false);
        });
    });
}

function getMarkdownFromEditorInstance(inst: Editor | WikiEditor): string {
    if (inst instanceof WikiEditor) {
        return inst.getMarkdown();
    }
    return inst.action(getMarkdown());
}

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
        let content = getMarkdownFromEditorInstance(window.wikiEditorInstance);
        
        // Restore ADO markers to original format
        content = postprocessAdoMarkers(content);

        if (attachmentServiceInstance) {
            content = attachmentServiceInstance.markdownRestoreRelativeAttachmentPaths(content);
        }

        // Restore mentions to storage format (@<GUID>)
        if (mentionService) {
            content = mentionService.restoreMentions(content);
        }

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
    let editorDiv = document.querySelector(`#${WIKI_EDITOR_ROOT_ID}`) as HTMLElement;
    if (!editorDiv) {
        editorDiv = document.createElement('div');
        editorDiv.id = WIKI_EDITOR_ROOT_ID;
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
    const editorDiv = document.querySelector(`#${WIKI_EDITOR_ROOT_ID}`);
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
 * Initialize the Milkdown Core Editor
 */
async function initializeEditor(textarea: HTMLTextAreaElement, editorDiv: HTMLElement): Promise<void> {
    const form = findClosest(textarea, 'form');
    
    // Detect current theme
    const useDarkTheme = isDarkTheme();
    
    // Initialize services
    const wikiInfo = getWikiInfoFromUrl();
    let attachmentService: AdoAttachmentService | null = null;
    attachmentServiceInstance = null;

    if (wikiInfo) {
        const wikiContext = {
            org: wikiInfo.org,
            projectId: wikiInfo.projectId,
            wikiId: wikiInfo.wikiIdentifier,
            wikiVersion: wikiInfo.version
        };

        attachmentService = new AdoAttachmentService(wikiContext);
        attachmentServiceInstance = attachmentService;
        mentionService = new AdoMentionService(wikiContext);
    }

    // Resolve mentions (GUID -> Name) and then preprocess
    let content = textarea.value;
    if (mentionService) {
        content = await mentionService.resolveMentions(content);
    }
    content = preprocessMentions(content);
    if (attachmentService) {
        await attachmentService.hydrateRepositoryId();
        content = attachmentService.rewriteMarkdownToDisplayUrls(content);
    }

    const useMilkdownWiki = await readUseMilkdownWikiEditor();
    if (!useMilkdownWiki) {
        try {
            let wikiRef!: WikiEditor;
            wikiRef = new WikiEditor(editorDiv, content, {
                attachmentService: attachmentService ?? undefined,
                mentionService: mentionService ?? undefined,
                onDocChanged: () => {
                    if (!isWysiwygMode) return;
                    let processedContent = wikiRef.getMarkdown();
                    processedContent = postprocessAdoMarkers(processedContent);
                    if (attachmentService) {
                        processedContent = attachmentService.markdownRestoreRelativeAttachmentPaths(processedContent);
                    }
                    if (mentionService) {
                        processedContent = mentionService.restoreMentions(processedContent);
                    }
                    textarea.value = processedContent;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                },
            });
            window.wikiEditorInstance = wikiRef;

            setupMentionProfileCard(editorDiv, mentionService);

            if (useDarkTheme) {
                editorDiv.classList.add(WIKI_EDITOR_DARK_CLASS);
            }

            if (form) {
                form.addEventListener('submit', function () {
                    syncEditorToTextarea(textarea);
                });
            }

            const proseMirror = editorDiv.querySelector('.ProseMirror');
            if (proseMirror) {
                const scrollCodeBlockToCursor = () => {
                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) return;

                    const range = selection.getRangeAt(0);
                    const cursorNode = range.startContainer;
                    const cursorPre =
                        cursorNode.nodeType === Node.TEXT_NODE
                            ? cursorNode.parentElement?.closest('pre')
                            : cursorNode.nodeType === Node.ELEMENT_NODE
                              ? (cursorNode as Element).closest('pre')
                              : null;

                    if (cursorPre) {
                        const cursorRect = range.getBoundingClientRect();
                        const preRect = cursorPre.getBoundingClientRect();
                        const pre = cursorPre as HTMLElement;

                        const cursorLeft = cursorRect.left - preRect.left + pre.scrollLeft;

                        if (cursorLeft < pre.scrollLeft) {
                            pre.scrollLeft = Math.max(0, cursorLeft - 20);
                        } else if (cursorLeft > pre.scrollLeft + pre.clientWidth - 20) {
                            pre.scrollLeft = cursorLeft - pre.clientWidth + 20;
                        }
                    }
                };

                proseMirror.addEventListener('input', () => setTimeout(scrollCodeBlockToCursor, 50));
                document.addEventListener('selectionchange', () => setTimeout(scrollCodeBlockToCursor, 50));
            }

            console.log('ProseMirror WikiEditor initialized');
        } catch (error) {
            console.error('Failed to initialize WikiEditor:', error);
        }
        return;
    }

    try {
        // Create Milkdown Core editor with plugins
        const editor = await Editor.make()
            .config(adoTheme)
            .config((ctx) => {
                // Set the root element
                ctx.set(rootCtx, editorDiv);
                
                // Set default content (already preprocessed)
                ctx.set(defaultValueCtx, content);
                
                // Inject attachment service for toolbar access
                ctx.inject(attachmentServiceCtx, attachmentService);

                // Configure upload plugin if service is available
                if (attachmentService) {
                    configureAttachmentUpload(ctx, attachmentService);
                }
                
                // Configure remark-stringify: ADO list style + safe attachment URLs (angle brackets; avoids `\)` from destinationRaw)
                const stringifyOpts = ctx.get(remarkStringifyOptionsCtx);
                ctx.set(remarkStringifyOptionsCtx, {
                    ...stringifyOpts,
                    bullet: '-',
                    bulletOther: '*',
                    handlers: {
                        ...stringifyOpts.handlers,
                        image: adoWikiAttachmentImageHandler,
                        link: adoWikiAttachmentLinkHandler,
                    },
                });
                
                // Add markdown listener for syncing to textarea
                ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, _prevMarkdown) => {
                    if (isWysiwygMode) {
                        // Restore ADO markers to original format
                        let processedContent = postprocessAdoMarkers(markdown);

                        if (attachmentService) {
                            processedContent = attachmentService.markdownRestoreRelativeAttachmentPaths(processedContent);
                        }

                        // Restore mentions to storage format (@<GUID>)
                        if (mentionService) {
                            processedContent = mentionService.restoreMentions(processedContent);
                        }

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
            .use(upload)
            .use(adoSyntaxPlugin)
            .use(toolbarPlugin)
            .use(adoHeadingAnchorPlugin)
            .use(attachmentImageResolvePlugin)
            .create();
        
        // Store the editor instance
        window.wikiEditorInstance = editor;

        setupMentionProfileCard(editorDiv, mentionService);
        
        // Apply dark theme class if needed
        if (useDarkTheme) {
            editorDiv.classList.add(WIKI_EDITOR_DARK_CLASS);
        }
        
        // Handle form submission
        if (form) {
            form.addEventListener('submit', function() {
                syncEditorToTextarea(textarea);
            });
        }
        
        // Auto-scroll code blocks to cursor position
        const proseMirror = editorDiv.querySelector('.ProseMirror');
        if (proseMirror) {
            const scrollCodeBlockToCursor = () => {
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) return;
                
                const range = selection.getRangeAt(0);
                const cursorNode = range.startContainer;
                const cursorPre = cursorNode.nodeType === Node.TEXT_NODE 
                    ? cursorNode.parentElement?.closest('pre')
                    : cursorNode.nodeType === Node.ELEMENT_NODE
                    ? (cursorNode as Element).closest('pre')
                    : null;
                
                if (cursorPre) {
                    const cursorRect = range.getBoundingClientRect();
                    const preRect = cursorPre.getBoundingClientRect();
                    const pre = cursorPre as HTMLElement;
                    
                    // Calculate cursor position relative to pre block
                    const cursorLeft = cursorRect.left - preRect.left + pre.scrollLeft;
                    
                    // Scroll horizontally if cursor is outside visible area
                    if (cursorLeft < pre.scrollLeft) {
                        pre.scrollLeft = Math.max(0, cursorLeft - 20); // 20px padding
                    } else if (cursorLeft > pre.scrollLeft + pre.clientWidth - 20) {
                        pre.scrollLeft = cursorLeft - pre.clientWidth + 20; // 20px padding
                    }
                }
            };
            
            // Monitor on input and selection change
            proseMirror.addEventListener('input', () => setTimeout(scrollCodeBlockToCursor, 50));
            proseMirror.addEventListener('selectionchange', () => setTimeout(scrollCodeBlockToCursor, 50));
            document.addEventListener('selectionchange', () => setTimeout(scrollCodeBlockToCursor, 50));
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
