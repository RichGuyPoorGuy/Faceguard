// Store tab authentication state
const tabAuthStates = {};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when the page is done loading
  if (changeInfo.status === 'complete' && tab.url) {
    console.log(`Tab ${tabId} updated: ${tab.url}`);
    
    // Check if extension is enabled
    chrome.storage.sync.get(['enabled', 'protectedSites'], (data) => {
      // Skip if extension is disabled
      if (data.enabled === false) {
        console.log("Extension is disabled, skipping protection");
        return;
      }
      
      // Skip if no protected sites
      if (!data.protectedSites || data.protectedSites.length === 0) {
        console.log("No protected sites configured");
        return;
      }
      
      try {
        // Get hostname from current URL
        const hostname = new URL(tab.url).hostname;
        console.log(`Checking protection for: ${hostname}`);
        
        // Check if this hostname needs protection
        if (data.protectedSites.includes(hostname)) {
          console.log(`${hostname} is in protected sites list`);
          
          // Check if this tab is already authenticated
          if (!tabAuthStates[tabId]) {
            console.log(`Tab ${tabId} needs authentication`);
            
            // Instead of opening a new tab, send message to content script
            chrome.tabs.sendMessage(tabId, {
              type: 'SHOW_AUTH_OVERLAY',
              url: tab.url
            });
          } else {
            console.log(`Tab ${tabId} already authenticated`);
          }
        } else {
          console.log(`${hostname} is not a protected site`);
        }
      } catch (e) {
        console.error("Error processing URL: ", e);
      }
    });
  }
});

// Listen for tab closing
chrome.tabs.onRemoved.addListener((tabId) => {
  // Remove auth state when tab is closed
  if (tabAuthStates[tabId]) {
    console.log(`Removing auth state for closed tab ${tabId}`);
    delete tabAuthStates[tabId];
  }
});

// Listen for authentication messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message, "from:", sender);
  
  if (message.type === 'AUTH_SUCCESS') {
    // Mark the tab as authenticated
    if (message.tabId) {
      console.log(`Authentication successful for tab ${message.tabId}`);
      tabAuthStates[message.tabId] = true;
      
      // Sending message to content script to remove the overlay
      chrome.tabs.sendMessage(message.tabId, {
        type: 'REMOVE_AUTH_OVERLAY'
      });
      
      sendResponse({status: "success"});
    }
  } else if (message.type === 'AUTH_FAILED') {
    // Handle failed authentication
    if (message.tabId) {
      console.log(`Authentication failed for tab ${message.tabId}`);
      
      // Navigate original tab to blocked page or home
      chrome.tabs.update(message.tabId, { url: 'https://www.google.com' });
      
      sendResponse({status: "failed"});
    }
  } else if (message.type === 'CHECK_AUTH_STATUS') {
    // Check if tab is already authenticated
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      const authenticated = !!tabAuthStates[tabId];
      console.log(`Auth status check for tab ${tabId}: ${authenticated}`);
      sendResponse({authenticated: authenticated});
    } else {
      sendResponse({authenticated: false});
    }
  } else if (message.type === 'GET_CURRENT_TAB') {
    // Return the current tab ID
    const tabId = sender.tab ? sender.tab.id : null;
    sendResponse({tabId: tabId});
  }
  
  // Need to return true if response is sent asynchronously
  return true;
});
