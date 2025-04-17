let active = false;

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
            try {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id ? tab.id : -1},
                    func: () => {
                        document.body.style.backgroundColor = color;
                    }
                }).then();
            } catch (error) {
                console.error('Error executing script:', error);
                chrome.runtime.sendMessage({action: 'error', message: 'Failed to execute script'});
            }
        } else {
            console.log('Azure DevOps Wiki Editor: Permissions denied');
        }
    });
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Azure DevOps Wiki Editor: Service Worker installed');
    // Just set initialized flag, no permissions request here
    chrome.storage.sync.set({initialized: true});
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Azure DevOps Wiki Editor: Service Worker started');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'log') {
        console.log(`Azure DevOps Wiki Editor: ${message.data}`);
    }
    sendResponse({status: 'received'});
});
