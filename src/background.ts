// Azure DevOps Wiki Editor - Background Service Worker

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
                    js: ['editor-bundle.js', 'main.js'],
                    css: ['milkdown-editor.css', 'custom-styles.css'],
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
