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
    // Drive setup off live DOM state, not a sticky latch. Our toggle lives
    // inside ADO's React tree, so it is present iff the *current* edit surface
    // is already wired up. After a SPA navigation ADO unmounts the old page
    // (and our toggle with it), so this correctly returns false on the new page.
    if (document.querySelector('#wysiwyg-toggle-container')) {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
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
        // View mode (or still rendering): no edit textarea yet. The always-on
        // MutationObserver stays connected as the durable trigger and re-enters
        // here the instant the user clicks "Edit"; armPoll() supplies a bounded
        // backstop poll for visibility flips that emit no DOM mutations.
        return;
    }

    const wikiEditor = document.querySelector('.wiki-editor') as HTMLElement;
    if (!wikiEditor) {
        return;
    }

    const textarea = visibleTextarea;

    // Insert the toggle synchronously so #wysiwyg-toggle-container exists right
    // away — this blocks the observer/poll from re-entering and double-mounting
    // while the async storage read below is in flight. Position is a cosmetic
    // attribute, so default to 'right' and refine it once storage resolves.
    const toggle = createModeToggle('right');
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

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['togglePosition'], function (result) {
            const position = result.togglePosition || 'right';
            toggle.setAttribute('data-position', position);
        });
    }
}

function armPoll(): void {
    // Bounded backstop poll. The MutationObserver is the primary trigger; this
    // covers edit-mode transitions that change visibility without emitting a DOM
    // mutation. Re-armed on every (re)bootstrap and SPA navigation so each new
    // page gets a fresh grace period.
    if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
    }
    retryCount = 0;

    const tick = (): void => {
        timeoutId = null;
        setupEditor();
        if (document.querySelector('#wysiwyg-toggle-container')) {
            return; // mounted — stop polling
        }
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            timeoutId = window.setTimeout(tick, 500);
        }
    };

    tick();
}

function observeDOM(): void {
    // Connect the observer once and keep it connected for the lifetime of the
    // document. ADO renders the wiki as a SPA, so document.body persists across
    // in-app navigations; a single long-lived observer re-detects each new edit
    // surface without us tearing down and reconnecting on every route change.
    if (!window.editorObserver) {
        window.editorObserver = new MutationObserver(() => {
            setupEditor();
        });

        window.editorObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    armPoll();
}

/**
 * Re-arm editor setup after an in-document SPA navigation (pushState /
 * replaceState / popstate). Azure DevOps renders the wiki as a single-page app,
 * so navigating between pages never triggers the declarative content-script
 * injection. Our toggle lives inside ADO's React tree and is unmounted when the
 * old page tears down, so we don't remove anything ourselves — we just re-arm
 * the bounded poll. The always-on MutationObserver (kept connected by
 * observeDOM) does the heavy lifting of detecting the new edit surface.
 *
 * Safe to call on every history event: if the current edit surface is still
 * mounted (e.g. ADO updated the URL while the user keeps editing), setupEditor
 * sees our toggle and returns immediately, so re-arming is a no-op — and we
 * deliberately do NOT touch isWysiwygMode, which would corrupt an active edit.
 */
function handleSpaNavigation(): void {
    if (!/\/_wiki\//i.test(window.location.href)) {
        // Navigated away from the wiki — leave the observer running but don't poll.
        return;
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
    // The IIFE already ran in this frame (declarative load, or a prior background
    // injection on the first SPA arrival). observeDOM() is idempotent: it reuses
    // the existing long-lived observer and just re-arms the bounded poll, so a
    // fresh edit surface is still picked up.
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
