// Azure DevOps Wiki Editor - Background Service Worker

/**
 * Matches any URL that contains `/_wiki/` on the built-in ADO hosts.
 * Used to decide whether SPA navigation warrants injecting the content script.
 */
const WIKI_URL_RE = /\/\/(?:[^/]+\.)?(?:dev\.azure\.com|visualstudio\.com)\/.*\/_wiki\//i;

/**
 * Register content scripts for custom domains stored in chrome.storage
 */
async function registerCustomDomainScripts(): Promise<void> {
    try {
        const result = await chrome.storage.sync.get(['customDomains']);
        const domains: string[] = result.customDomains || [];

        for (const domain of domains) {
            const scriptId = 'custom-' + domain.replace(/[^a-zA-Z0-9]/g, '_');

            try {
                await chrome.scripting.registerContentScripts([{
                    id: scriptId,
                    matches: [`*://${domain}/*/_wiki/*`],
                    js: ['content.js'],
                    css: ['content.css', 'custom-styles.css'],
                    runAt: 'document_idle'
                }]);
                console.log(`Azure DevOps Wiki Editor: Registered script for ${domain}`);
            } catch (err) {
                // Script might already be registered, ignore error
                console.log(`Azure DevOps Wiki Editor: Script for ${domain} already registered or error:`, err);
            }
        }
    } catch (error) {
        console.error('Azure DevOps Wiki Editor: Error registering custom domain scripts:', error);
    }
}

/**
 * Idempotently inject the content script + CSS into a tab frame that arrived at
 * a wiki page via SPA navigation (History API / pushState) — no document reload
 * happens, so the declarative `content_scripts` entry is never triggered.
 *
 * Guard: if `window.__adoWikiEditorLoaded` is already `true` in the frame we
 * skip injection to avoid double-running the content script (handles the case
 * where a declarative injection already ran on a normal page load).
 */
async function injectContentScriptIfNeeded(tabId: number, frameId: number): Promise<void> {
    try {
        // Probe whether the content script is already active in this frame.
        const probe = await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: (): boolean =>
                (window as Window & { __adoWikiEditorLoaded?: boolean }).__adoWikiEditorLoaded === true,
        });

        if (probe?.[0]?.result === true) {
            console.debug('Azure DevOps Wiki Editor: content script already loaded, skipping injection');
            return;
        }

        // Inject CSS first so the toggle renders without flash.
        await chrome.scripting.insertCSS({
            target: { tabId, frameIds: [frameId] },
            files: ['content.css', 'katex/katex.min.css', 'custom-styles.css'],
        });

        // Inject the JS bundle.
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            files: ['content.js'],
        });

        console.log(`Azure DevOps Wiki Editor: Injected content script into tab ${tabId} frame ${frameId} via SPA navigation`);
    } catch (err) {
        // Frames can disappear or be cross-origin; log at debug level and continue.
        console.debug(`Azure DevOps Wiki Editor: Could not inject into tab ${tabId} frame ${frameId}:`, err);
    }
}

// Service worker installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Azure DevOps Wiki Editor: Service Worker installed');

    // Initialize storage
    try {
        await chrome.storage.sync.set({ initialized: true });
        // Register any previously saved custom domains
        await registerCustomDomainScripts();
    } catch (error) {
        console.error('Azure DevOps Wiki Editor: Error during installation:', error);
    }
});

// Service worker startup - re-register custom domain scripts
chrome.runtime.onStartup.addListener(async () => {
    console.log('Azure DevOps Wiki Editor: Service Worker started');
    await registerCustomDomainScripts();
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'log') {
        console.log(`Azure DevOps Wiki Editor: ${message.data}`);
    } else if (message.action === 'registerDomain') {
        // Handle domain registration request from popup
        registerCustomDomainScripts().then(() => {
            sendResponse({ status: 'success' });
        }).catch((error) => {
            sendResponse({ status: 'error', message: error.message });
        });
        return true; // Keep message channel open for async response
    }

    sendResponse({ status: 'received' });
    return true;
});

// Listen for storage changes to update content scripts
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.customDomains) {
        console.log('Azure DevOps Wiki Editor: Custom domains changed, re-registering scripts');
        registerCustomDomainScripts();
    }
});

/**
 * Inject the content script when the SPA navigates to a wiki URL.
 * `onHistoryStateUpdated` fires for every `pushState` / `replaceState` call,
 * including Azure DevOps in-app navigation, so we filter to wiki URLs on the
 * two built-in ADO hosts only (custom domains use optional_host_permissions
 * and get the declarative injection via registerCustomDomainScripts).
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (!WIKI_URL_RE.test(details.url)) {
        return; // Not a wiki URL — nothing to do.
    }

    void injectContentScriptIfNeeded(details.tabId, details.frameId);
});
