let active = false;

chrome.action.onClicked.addListener((tab) => {
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
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Azure DevOps Wiki Editor: Service Worker installed');
    // Perform additional setup tasks on installation
    chrome.storage.sync.set({initialized: true});
    // Handle required permissions
    chrome.permissions.request({
        permissions: ['storage'],
        origins: ['*://dev.azure.com/*/_wiki/*', '*://*.visualstudio.com/*/_wiki/*']
    }, (granted) => {
        if (granted) {
            console.log('Azure DevOps Wiki Editor: Permissions granted');
        } else {
            console.log('Azure DevOps Wiki Editor: Permissions denied');
        }
    });
    // Set up event listeners or alarms
    chrome.alarms.create('refresh', {periodInMinutes: 60});
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
