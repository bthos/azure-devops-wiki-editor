// Azure DevOps Wiki Editor - Popup Script

document.addEventListener("DOMContentLoaded", function () {
    loadDomains();
    
    document.getElementById("addDomain").addEventListener("click", addDomain);
    document.getElementById("customDomain").addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            addDomain();
        }
    });
});

/**
 * Load saved custom domains and display them
 */
function loadDomains() {
    chrome.storage.sync.get(['customDomains'], function(result) {
        const domains = result.customDomains || [];
        renderDomainList(domains);
    });
}

/**
 * Render the list of custom domains
 */
function renderDomainList(domains) {
    const listContainer = document.getElementById('domainList');
    listContainer.innerHTML = '';
    
    if (domains.length === 0) {
        listContainer.innerHTML = '<div style="color: #8a8886; font-size: 11px; padding: 4px 0;">No custom domains added</div>';
        return;
    }
    
    domains.forEach(function(domain, index) {
        const item = document.createElement('div');
        item.className = 'domain-item';
        item.innerHTML = `
            <span>${domain}</span>
            <button class="remove-btn" data-index="${index}">Remove</button>
        `;
        listContainer.appendChild(item);
    });
    
    // Add event listeners for remove buttons
    listContainer.querySelectorAll('.remove-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeDomain(index);
        });
    });
}

/**
 * Add a new custom domain
 */
function addDomain() {
    const input = document.getElementById('customDomain');
    let domain = input.value.trim();
    
    if (!domain) {
        showStatus('Please enter a domain', 'error');
        return;
    }
    
    // Clean up the domain - remove protocol if present
    domain = domain.replace(/^https?:\/\//, '');
    // Remove trailing slashes
    domain = domain.replace(/\/+$/, '');
    // Remove any path
    domain = domain.split('/')[0];
    
    // Validate domain format
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$/.test(domain)) {
        showStatus('Invalid domain format', 'error');
        return;
    }
    
    // First, request host permission for this domain
    const originPattern = `*://${domain}/*`;
    
    chrome.permissions.request({
        origins: [originPattern]
    }, function(granted) {
        if (!granted) {
            showStatus('Permission denied for this domain', 'error');
            return;
        }
        
        chrome.storage.sync.get(['customDomains'], function(result) {
            const domains = result.customDomains || [];
            
            // Check for duplicates
            if (domains.includes(domain)) {
                showStatus('Domain already exists', 'error');
                return;
            }
            
            // Add new domain
            domains.push(domain);
            
            chrome.storage.sync.set({ customDomains: domains }, function() {
                if (chrome.runtime.lastError) {
                    showStatus('Error saving domain', 'error');
                    return;
                }
                
                input.value = '';
                renderDomainList(domains);
                showStatus('Domain added! Reload wiki pages to apply.', 'success');
                
                // Register the content script for this domain
                registerContentScript(domain);
            });
        });
    });
}

/**
 * Remove a custom domain by index
 */
function removeDomain(index) {
    chrome.storage.sync.get(['customDomains'], function(result) {
        const domains = result.customDomains || [];
        const removed = domains.splice(index, 1)[0];
        
        chrome.storage.sync.set({ customDomains: domains }, function() {
            if (chrome.runtime.lastError) {
                showStatus('Error removing domain', 'error');
                return;
            }
            
            renderDomainList(domains);
            showStatus('Domain removed', 'success');
            
            // Unregister the content script for this domain
            unregisterContentScript(removed);
        });
    });
}

/**
 * Register content script for a custom domain
 */
function registerContentScript(domain) {
    const scriptId = 'custom-' + domain.replace(/[^a-zA-Z0-9]/g, '_');
    
    chrome.scripting.registerContentScripts([{
        id: scriptId,
        matches: [`*://${domain}/*/_wiki/*`],
        js: ['editor-bundle.js', 'main.js'],
        css: ['toastui-editor.css', 'custom-styles.css'],
        runAt: 'document_idle'
    }]).catch(function(err) {
        // Script might already be registered, ignore error
        console.log('Content script registration:', err.message);
    });
}

/**
 * Unregister content script for a domain
 */
function unregisterContentScript(domain) {
    const scriptId = 'custom-' + domain.replace(/[^a-zA-Z0-9]/g, '_');
    
    chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(function(err) {
        console.log('Content script unregistration:', err.message);
    });
}

/**
 * Show a status message
 */
function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = 'status-message status-' + type;
    statusEl.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(function() {
        statusEl.style.display = 'none';
    }, 3000);
}
