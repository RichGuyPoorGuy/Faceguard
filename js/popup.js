document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const enableExtension = document.getElementById('enableExtension');
    const statusText = document.getElementById('statusText');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const newSiteUrl = document.getElementById('newSiteUrl');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const siteList = document.getElementById('siteList');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('captureBtn');
    const saveFaceBtn = document.getElementById('saveFaceBtn');
    const registeredFaces = document.getElementById('registeredFaces');
    const failedAttempts = document.getElementById('failedAttempts');
    const securityPassword = document.getElementById('securityPassword');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  
    let capturedFace = null;
    let mediaStream = null;
  
    // Initialize extension state
    initializeExtension();
  
    // Tab switching functionality
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons and panes
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
  
        // Add active class to clicked button and corresponding pane
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
  
        // Special handling for face management tab
        if (tabId === 'face-management') {
          startCamera();
        } else {
          stopCamera();
        }
      });
    });
  
    // Enable/disable extension
    enableExtension.addEventListener('change', function() {
      const enabled = this.checked;
      statusText.textContent = enabled ? 'Enabled' : 'Disabled';
  
      // Save extension state
      chrome.storage.sync.set({ enabled: enabled });
    });
  
    // Add site functionality
    addSiteBtn.addEventListener('click', function() {
      addProtectedSite();
    });
  
    newSiteUrl.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        addProtectedSite();
      }
    });
  
    // Face capture functionality
    captureBtn.addEventListener('click', function() {
      captureFace();
    });
  
    saveFaceBtn.addEventListener('click', function() {
      saveFace();
    });
  
    // Settings save functionality
    saveSettingsBtn.addEventListener('click', function() {
      saveSettings();
    });
  
    // Initialize extension
    function initializeExtension() {
      // Load extension state
      chrome.storage.sync.get(['enabled', 'protectedSites', 'faces', 'settings'], function(data) {
        // Extension toggle state
        enableExtension.checked = data.enabled !== false; // Default to true if not set
        statusText.textContent = enableExtension.checked ? 'Enabled' : 'Disabled';
  
        // Load protected sites
        if (data.protectedSites && data.protectedSites.length > 0) {
          renderProtectedSites(data.protectedSites);
        }
  
        // Load faces
        if (data.faces && data.faces.length > 0) {
          renderFaces(data.faces);
        }
  
        // Load settings
        if (data.settings) {
          failedAttempts.value = data.settings.maxAttempts || 3;
          securityPassword.value = data.settings.password || '';
        }
      });
    }
  
    // Function to add a protected site
    function addProtectedSite() {
      let url = newSiteUrl.value.trim();
      
      if (!url) return;
      
      // Add http:// if not present
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      try {
        // Extract hostname
        const hostname = new URL(url).hostname;
        
        chrome.storage.sync.get(['protectedSites'], function(data) {
          const sites = data.protectedSites || [];
          
          // Check if site already exists
          if (!sites.includes(hostname)) {
            sites.push(hostname);
            chrome.storage.sync.set({ protectedSites: sites }, function() {
              renderProtectedSites(sites);
              newSiteUrl.value = '';
            });
          } else {
            alert('This site is already protected!');
          }
        });
      } catch (e) {
        alert('Please enter a valid URL');
      }
    }
  
    // Function to render protected sites
    function renderProtectedSites(sites) {
      siteList.innerHTML = '';
      
      if (sites.length === 0) {
        siteList.innerHTML = '<div class="empty-message">No protected sites yet</div>';
        return;
      }
      
      sites.forEach(site => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        
        const urlSpan = document.createElement('span');
        urlSpan.className = 'url';
        urlSpan.textContent = site;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete';
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', function() {
          removeSite(site);
        });
        
        siteItem.appendChild(urlSpan);
        siteItem.appendChild(deleteBtn);
        siteList.appendChild(siteItem);
      });
    }
  
    // Function to remove a site
    function removeSite(site) {
      chrome.storage.sync.get(['protectedSites'], function(data) {
        const sites = data.protectedSites || [];
        const updatedSites = sites.filter(s => s !== site);
        
        chrome.storage.sync.set({ protectedSites: updatedSites }, function() {
          renderProtectedSites(updatedSites);
        });
      });
    }
  
      // Functions for camera handling
  async function startCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 320 }, // Reduced from 640 to lower resolution
          height: { ideal: 240 }, // Reduced from 480 to lower resolution
          facingMode: "user"
        } 
      });
      video.srcObject = mediaStream;
      console.log("Camera started successfully");
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Could not access the camera. Please check permissions.");
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      video.srcObject = null;
      mediaStream = null;
      console.log("Camera stopped");
    }
  }

  function captureFace() {
    if (!video.srcObject) {
      console.error("No camera stream available");
      alert("Camera is not active. Please try again.");
      return;
    }

    const context = canvas.getContext('2d');
    // Set canvas to a smaller size to reduce image size
    canvas.width = 320;
    canvas.height = 240;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to a compressed JPEG instead of PNG
    capturedFace = canvas.toDataURL('image/jpeg', 0.7); // 0.7 quality for better compression
    saveFaceBtn.disabled = false;
    console.log("Face captured successfully");
  }

  function saveFace() {
    if (!capturedFace) {
      console.error("No face captured");
      alert("Please capture a face image first");
      return;
    }

    // Create a smaller image to save in storage
    const img = new Image();
    img.onload = function() {
      // Create a new canvas for resizing
      const resizeCanvas = document.createElement('canvas');
      // Set to even smaller size for storage
      resizeCanvas.width = 160;  // Smaller width
      resizeCanvas.height = 120; // Smaller height
      
      // Draw and resize image
      const ctx = resizeCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, resizeCanvas.width, resizeCanvas.height);
      
      // Create compressed JPEG
      const compressedImage = resizeCanvas.toDataURL('image/jpeg', 0.5);
      
      chrome.storage.sync.get(['faces'], function(data) {
        const faces = data.faces || [];
        const newFace = {
          id: Date.now().toString(),
          image: compressedImage
        };
        
        faces.push(newFace);
        
        chrome.storage.sync.set({ faces: faces }, function() {
          if (chrome.runtime.lastError) {
            console.error("Error saving face:", chrome.runtime.lastError);
            // Try saving to local storage instead
            chrome.storage.local.set({ faces: faces }, function() {
              if (chrome.runtime.lastError) {
                alert("Failed to save face. The image might still be too large. Try capturing again with less light or a simpler background.");
              } else {
                renderFaces(faces);
                saveFaceBtn.disabled = true;
                capturedFace = null;
                console.log("Face saved to local storage successfully");
                alert("Face registered successfully!");
              }
            });
          } else {
            renderFaces(faces);
            saveFaceBtn.disabled = true;
            capturedFace = null;
            console.log("Face saved successfully");
            alert("Face registered successfully!");
          }
        });
      });
    };
    
    img.src = capturedFace;
  }

  function renderFaces(faces) {
    registeredFaces.innerHTML = '';
    
    if (faces.length === 0) {
      registeredFaces.innerHTML = '<div class="empty-message">No faces registered yet</div>';
      return;
    }
    
    faces.forEach(face => {
      const faceItem = document.createElement('div');
      faceItem.className = 'face-item';
      
      const faceImg = document.createElement('img');
      faceImg.src = face.image;
      faceImg.alt = "Registered face";
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete';
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', function() {
        removeFace(face.id);
      });
      
      faceItem.appendChild(faceImg);
      faceItem.appendChild(deleteBtn);
      registeredFaces.appendChild(faceItem);
    });
  }

  function removeFace(faceId) {
    // Try both sync and local storage
    chrome.storage.sync.get(['faces'], function(syncData) {
      chrome.storage.local.get(['faces'], function(localData) {
        // Use faces from either storage
        const faces = syncData.faces || localData.faces || [];
        const updatedFaces = faces.filter(face => face.id !== faceId);
        
        // Update both storage types
        chrome.storage.sync.set({ faces: updatedFaces });
        chrome.storage.local.set({ faces: updatedFaces });
        
        renderFaces(updatedFaces);
      });
    });
  }

  function saveSettings() {
    const maxAttempts = parseInt(failedAttempts.value) || 3;
    const password = securityPassword.value;
    
    const settings = {
      maxAttempts: maxAttempts,
      password: password
    };
    
    chrome.storage.sync.set({ settings: settings }, function() {
      alert('Settings saved successfully!');
    });
  }
});
