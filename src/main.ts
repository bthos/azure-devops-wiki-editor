// Azure DevOps Wiki Editor - Main Content Script
// WYSIWYG: ProseMirror {@link WikiEditor} (Manifest V3 content script).

import {
    isDarkTheme,
    AdoAttachmentService,
    AdoMentionService,
    WikiEditor,
} from './editor-bundle';

import { getWikiInfoFromUrl } from './ado-wiki-api';
import { setupMentionProfileCard } from './plugins/mention-profile-card';
import { postprocessAdoMarkers, preprocessMentions } from './utils/wiki-markers';
import { WIKI_EDITOR_DARK_CLASS, WIKI_EDITOR_ROOT_ID } from './editor/wiki-editor-dom';

declare global {
    interface Window {
        editorObserver?: MutationObserver;
        wikiEditorInstance?: WikiEditor;
        /** Set to `true` after first content-script execution to guard against re-injection. */
        __adoWikiEditorLoaded?: boolean;
    }
}

export {};

const MAX_RETRIES = 10;
let retryCount = 0;
let timeoutId: number | null = null;
let editorReady = false;
let isWysiwygMode = false;
let mentionService: AdoMentionService | null = null;
let attachmentServiceInstance: AdoAttachmentService | null = null;

/** Removes code-block scroll listeners from the previous mount (toggle / re-init). */
let detachCodeBlockScrollListeners: (() => void) | null = null;

const formWikiSubmitHandlers = new WeakMap<HTMLFormElement, () => void>();

function getMarkdownFromEditorInstance(inst: WikiEditor): string {
    return inst.getMarkdown();
}

function isElementVisible(element: HTMLElement): boolean {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) &&
        window.getComputedStyle(element).display !== 'none';
}

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

function syncEditorToTextarea(textarea: HTMLTextAreaElement): void {
    if (window.wikiEditorInstance) {
        let content = getMarkdownFromEditorInstance(window.wikiEditorInstance);

        content = postprocessAdoMarkers(content);

        if (attachmentServiceInstance) {
            content = attachmentServiceInstance.markdownRestoreRelativeAttachmentPaths(content);
        }

        if (mentionService) {
            content = mentionService.restoreMentions(content);
        }

        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function enableWysiwygMode(textarea: HTMLTextAreaElement, wikiEditor: HTMLElement): void {
    isWysiwygMode = true;

    const adoToolbar = wikiEditor.querySelector('.we-toolbar-container');
    if (adoToolbar) {
        (adoToolbar as HTMLElement).style.display = 'none';
    }

    const wikiMarkdownToolbar = document.querySelector('.wiki-markdown-toolbar');
    if (wikiMarkdownToolbar) {
        (wikiMarkdownToolbar as HTMLElement).style.display = 'none';
    }

    const previewContainer = wikiEditor.querySelector('.we-text-preview-container');
    if (previewContainer) {
        (previewContainer as HTMLElement).style.display = 'none';
    }

    const taContainer = wikiEditor.querySelector('.we-ta-container');
    if (taContainer) {
        (taContainer as HTMLElement).style.display = 'none';
    }

    let editorDiv = document.querySelector(`#${WIKI_EDITOR_ROOT_ID}`) as HTMLElement;
    if (!editorDiv) {
        editorDiv = document.createElement('div');
        editorDiv.id = WIKI_EDITOR_ROOT_ID;
        wikiEditor.appendChild(editorDiv);
    }
    editorDiv.style.display = 'block';

    if (window.wikiEditorInstance) {
        try {
            window.wikiEditorInstance.destroy();
        } catch (e) {
            console.warn('Error destroying editor:', e);
        }
        window.wikiEditorInstance = undefined;
        editorDiv.innerHTML = '';
    }

    void initializeEditor(textarea, editorDiv);

    updateToggleLabels(true);
}

function disableWysiwygMode(textarea: HTMLTextAreaElement, wikiEditor: HTMLElement): void {
    isWysiwygMode = false;

    syncEditorToTextarea(textarea);

    const adoToolbar = wikiEditor.querySelector('.we-toolbar-container');
    if (adoToolbar) {
        (adoToolbar as HTMLElement).style.display = '';
    }

    const wikiMarkdownToolbar = document.querySelector('.wiki-markdown-toolbar');
    if (wikiMarkdownToolbar) {
        (wikiMarkdownToolbar as HTMLElement).style.display = '';
    }

    const previewContainer = wikiEditor.querySelector('.we-text-preview-container');
    if (previewContainer) {
        (previewContainer as HTMLElement).style.display = '';
    }

    const taContainer = wikiEditor.querySelector('.we-ta-container');
    if (taContainer) {
        (taContainer as HTMLElement).style.display = '';
    }

    const editorDiv = document.querySelector(`#${WIKI_EDITOR_ROOT_ID}`);
    if (editorDiv) {
        (editorDiv as HTMLElement).style.display = 'none';
    }

    updateToggleLabels(false);
}

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

async function initializeEditor(textarea: HTMLTextAreaElement, editorDiv: HTMLElement): Promise<void> {
    detachCodeBlockScrollListeners?.();
    detachCodeBlockScrollListeners = null;

    const form = findClosest(textarea, 'form');

    const useDarkTheme = isDarkTheme();

    const wikiInfo = getWikiInfoFromUrl();
    let attachmentService: AdoAttachmentService | null = null;
    attachmentServiceInstance = null;

    if (wikiInfo) {
        const wikiContext = {
            org: wikiInfo.org,
            projectId: wikiInfo.projectId,
            wikiId: wikiInfo.wikiIdentifier,
            wikiVersion: wikiInfo.version,
        };

        attachmentService = new AdoAttachmentService(wikiContext);
        attachmentServiceInstance = attachmentService;
        mentionService = new AdoMentionService(wikiContext);
    }

    try {
        let content = textarea.value;
        if (mentionService) {
            content = await mentionService.resolveMentions(content);
        }
        content = preprocessMentions(content);
        if (attachmentService) {
            await attachmentService.hydrateRepositoryId();
            content = attachmentService.rewriteMarkdownToDisplayUrls(content);
        }

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
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            },
        });
        window.wikiEditorInstance = wikiRef;

        setupMentionProfileCard(editorDiv, mentionService);

        if (useDarkTheme) {
            editorDiv.classList.add(WIKI_EDITOR_DARK_CLASS);
        }

        if (form instanceof HTMLFormElement) {
            const prevSubmit = formWikiSubmitHandlers.get(form);
            if (prevSubmit) {
                form.removeEventListener('submit', prevSubmit);
            }
            const submitHandler = () => {
                syncEditorToTextarea(textarea);
            };
            form.addEventListener('submit', submitHandler);
            formWikiSubmitHandlers.set(form, submitHandler);
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

            const onInput = () => setTimeout(scrollCodeBlockToCursor, 50);
            const onSelectionChange = () => setTimeout(scrollCodeBlockToCursor, 50);
            proseMirror.addEventListener('input', onInput);
            document.addEventListener('selectionchange', onSelectionChange);
            detachCodeBlockScrollListeners = () => {
                proseMirror.removeEventListener('input', onInput);
                document.removeEventListener('selectionchange', onSelectionChange);
            };
        }

        console.log('WikiEditor initialized');
    } catch (error) {
        console.error('Failed to initialize WikiEditor:', error);
    }
}

function setupEditor(): void {
    if (editorReady) {
        return;
    }

    if (retryCount >= MAX_RETRIES) {
        console.error('Failed to setup editor after multiple retries');
        return;
    }

    const textareas = document.querySelectorAll('.we-ta-container textarea');
    let visibleTextarea: HTMLTextAreaElement | null = null;

    for (let i = 0; i < textareas.length; i++) {
        if (isElementVisible(textareas[i] as HTMLTextAreaElement)) {
            visibleTextarea = textareas[i] as HTMLTextAreaElement;
            break;
        }
    }

    if (!visibleTextarea) {
        retryCount++;
        timeoutId = window.setTimeout(setupEditor, 500);
        return;
    }

    editorReady = true;

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

    if (document.querySelector('#wysiwyg-toggle-container')) {
        return;
    }

    function createToggleWithPosition(position: string) {
        const toggle = createModeToggle(position);
        wikiEditor.insertBefore(toggle, wikiEditor.firstChild);

        const toggleInput = document.querySelector('#wysiwyg-toggle-input') as HTMLInputElement;
        if (toggleInput) {
            toggleInput.addEventListener('change', function () {
                if (this.checked) {
                    enableWysiwygMode(textarea, wikiEditor);
                } else {
                    disableWysiwygMode(textarea, wikiEditor);
                }
            });
        }
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['togglePosition'], function (result) {
            const position = result.togglePosition || 'right';
            createToggleWithPosition(position);
        });
    } else {
        createToggleWithPosition('right');
    }
}

function observeDOM(): void {
    window.editorObserver = new MutationObserver(() => {
        if (retryCount < MAX_RETRIES && !editorReady) {
            setupEditor();
        }
    });

    window.editorObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

    setupEditor();
}

/**
 * Reset editor state and re-run setup after an in-document SPA navigation.
 * Called by the pushState / replaceState / popstate listeners below.
 *
 * Guard against tight loops: only reset if the toggle container has been
 * removed from the DOM (meaning the SPA actually tore down the wiki view)
 * and the current URL is a wiki URL.
 */
function handleSpaNavigation(): void {
    const togglePresent = !!document.querySelector('#wysiwyg-toggle-container');
    if (editorReady && togglePresent) {
        // Editor is live and the DOM hasn't changed — nothing to do.
        return;
    }

    if (!/\/_wiki\//i.test(window.location.href)) {
        // Navigated away from the wiki — don't attempt to set up.
        return;
    }

    // Reset latches so setupEditor can run fresh.
    editorReady = false;
    retryCount = 0;
    isWysiwygMode = false;

    if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
    }
    if (window.editorObserver) {
        window.editorObserver.disconnect();
        delete window.editorObserver;
    }

    observeDOM();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
//
// The content script runs inside an IIFE (esbuild `format: 'iife'`).  When the
// background service worker re-injects content.js via `chrome.scripting.executeScript`
// after a SPA navigation, the IIFE runs a second time with fresh local variables.
// `window.__adoWikiEditorLoaded` is the cross-run sentinel on the shared `window`
// object so the second run can disconnect the stale observer and restart cleanly.
//
// On first load we also wire up pushState / replaceState monkeypatches so that
// in-document wiki-page-to-wiki-page navigations are handled entirely within the
// content script, without needing a background round-trip.

if (window.__adoWikiEditorLoaded) {
    // ── Re-injection path ────────────────────────────────────────────────────
    // The background script already verified `__adoWikiEditorLoaded === false`
    // before injecting, so this branch executes only when a previous run set the
    // flag (e.g. declarative injection on a hard reload) and then background
    // injects again on a subsequent SPA navigation where the flag was missed.
    // Reset and re-init defensively.
    editorReady = false;
    retryCount = 0;
    if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
    }
    if (window.editorObserver) {
        window.editorObserver.disconnect();
        delete window.editorObserver;
    }
    observeDOM();
} else {
    // ── First-load path ───────────────────────────────────────────────────────
    window.__adoWikiEditorLoaded = true;

    // Register SPA navigation listeners once so they persist across in-document
    // route changes without accumulating duplicate handlers.
    window.addEventListener('popstate', handleSpaNavigation);

    // Monkeypatch History API to catch pushState / replaceState navigation.
    // Both methods are bound to `history` before wrapping so the originals are
    // called with the correct receiver regardless of `this` at call sites.
    const origPushState = history.pushState.bind(history) as typeof history.pushState;
    const origReplaceState = history.replaceState.bind(history) as typeof history.replaceState;

    history.pushState = function (...args: Parameters<typeof history.pushState>): void {
        origPushState(...args);
        window.dispatchEvent(new Event('__adoWikiEditorNavigate'));
    };

    history.replaceState = function (...args: Parameters<typeof history.replaceState>): void {
        origReplaceState(...args);
        window.dispatchEvent(new Event('__adoWikiEditorNavigate'));
    };

    window.addEventListener('__adoWikiEditorNavigate', handleSpaNavigation);

    // Normal document-load bootstrap.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeDOM);
    } else {
        observeDOM();
    }
}
