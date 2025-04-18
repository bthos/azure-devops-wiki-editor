let active = false;

// Define the function outside of the callback to avoid dynamic evaluation
function setBackgroundColor(color: string) {
    document.body.style.backgroundColor = color;
}

chrome.action.onClicked.addListener((tab) => {
    // Request permissions when user clicks the extension icon
    chrome.permissions.request({
        permissions: ['storage'],
        origins: ['*://dev.azure.com/*/_wiki/*', '*://*.visualstudio.com/*/_wiki/*']
    }, (granted) => {
        if (granted) {
            console.log('Azure DevOps Wiki Editor: Permissions granted');
            // Only proceed with activation if permissions are granted
            active = !active;
            const color = active ? 'orange' : 'white';
            
            if (tab.id && tab.id !== -1) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: setBackgroundColor,
                    args: [color]
                }).catch((error) => {
                    console.error('Error executing script:', error);
                    chrome.runtime.sendMessage({
                        action: 'error',
                        message: 'Failed to execute script'
                    }).catch(console.error);
                });
            }
        } else {
            console.log('Azure DevOps Wiki Editor: Permissions denied');
        }
    });
});

// Service worker installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Azure DevOps Wiki Editor: Service Worker installed');
    // Just set initialized flag, no permissions request here
    chrome.storage.sync.set({initialized: true}).catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Azure DevOps Wiki Editor: Service Worker started');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'log') {
        console.log(`Azure DevOps Wiki Editor: ${message.data}`);
    }
    sendResponse({status: 'received'});
    return true; // Required for async response
});
