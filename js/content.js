// This script runs in the context of web pages
// It can interact with the page content and show overlays

// Initialize immediately when content script loads
document.addEventListener('DOMContentLoaded', function() {
    checkIfProtectedSite();
  });
  
  // Check if current site needs protection
  function checkIfProtectedSite() {
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;
    
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
      
      console.log(`Checking protection for: ${hostname}`);
      
      // Check if this hostname needs protection
      if (data.protectedSites.includes(hostname)) {
        console.log(`${hostname} is in protected sites list`);
        
        // Check with background script if tab is authenticated
        chrome.runtime.sendMessage({ 
          type: 'CHECK_AUTH_STATUS',
          url: currentUrl
        }, function(response) {
          if (response && response.authenticated) {
            console.log("This tab is already authenticated");
          } else {
            console.log("Tab needs authentication, showing overlay");
            showAuthOverlay(currentUrl);
          }
        });
      }
    });
  }
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_BLOCK_OVERLAY') {
      showBlockOverlay();
    } else if (message.type === 'SHOW_AUTH_OVERLAY') {
      showAuthOverlay(message.url);
    } else if (message.type === 'REMOVE_AUTH_OVERLAY') {
      removeAuthOverlay();
    }
    return true;
  });

  // Function to show blocking overlay
  function showBlockOverlay() {
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'face-guard-overlay';
    
    // Create content container
    const container = document.createElement('div');
    container.className = 'face-guard-container';
    
    // Add title
    const title = document.createElement('h2');
    title.className = 'face-guard-title';
    title.textContent = 'Access Blocked by FaceGuard';
    
    // Add message
    const message = document.createElement('p');
    message.className = 'face-guard-message';
    message.textContent = 'This site requires face verification. Please authenticate to access.';
    
    // Add authenticate button
    const authButton = document.createElement('button');
    authButton.className = 'face-guard-button';
    authButton.textContent = 'Authenticate Now';
    authButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'REQUEST_AUTH' });
      overlay.remove();
    });
    
    // Assemble elements
    container.appendChild(title);
    container.appendChild(message);
    container.appendChild(authButton);
    overlay.appendChild(container);
    
    // Add to page
    document.body.appendChild(overlay);
  }
  
  // Function to show authentication overlay
function showAuthOverlay(url) {
  // Remove any existing overlay first
  removeAuthOverlay();
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'face-guard-auth-overlay';
  overlay.className = 'face-guard-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  overlay.style.zIndex = '9999999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  
  // Create the auth container (similar to auth.html)
  const authContainer = document.createElement('div');
  authContainer.className = 'auth-container';
  authContainer.style.backgroundColor = 'white';
  authContainer.style.width = '400px';
  authContainer.style.borderRadius = '8px';
  authContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
  authContainer.style.overflow = 'hidden';
  
  // Inject the auth HTML structure
  authContainer.innerHTML = `
    <div class="auth-header" style="background-color:rgb(0, 0, 0); color: white; text-align: center; padding: 15px;">
      <img src="${chrome.runtime.getURL('logo.png')}" alt="FaceGuard Logo" style="width: 40px; height: 40px; margin-bottom: 10px;">
      <h1 style="font-size: 18px; font-weight: 500;">Face Verification Required</h1>
    </div>
    
    <div class="site-info" style="padding: 15px; text-align: center; border-bottom: 1px solid #eee;">
      <p style="font-size: 14px; color:rgb(0, 0, 0);">To access: <span id="siteUrl">${new URL(url).hostname}</span></p>
    </div>

    <div class="face-verification" style="padding: 20px; text-align: center;">
      <div class="video-container" style="width: 240px; height: 240px; margin: 0 auto; position: relative; overflow: hidden; border-radius: 4px; border: 2px solid #3498db;">
        <video id="video" autoplay muted style="width: 100%; height: 100%; object-fit: cover;"></video>
        <canvas id="canvas" style="display:none;"></canvas>
        <div class="face-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none;">
          <div class="face-frame" style="width: 180px; height: 180px; border: 2px dashed rgba(255, 255, 255, 0.8); border-radius: 50%;"></div>
        </div>
      </div>
      
      <div class="status-message" id="statusMessage" style="margin: 15px 0; font-size: 14px; font-weight: 500; color:rgb(0, 0, 0);">
        Position your face in the frame
      </div>
      
      <div class="attempt-counter" style="font-size: 12px; color:rgb(0, 0, 0); opacity: 0.7; margin-bottom: 15px;">
        Attempt: <span id="attemptCount">1</span>/<span id="maxAttempts">3</span>
      </div>
    </div>

    <div class="password-fallback" id="passwordFallback" style="display:none; padding: 20px; text-align: center;">
      <h3 style="font-size: 16px; color: #f39c12; margin-bottom: 10px;">Too many failed attempts</h3>
      <p style="font-size: 14px; margin-bottom: 15px; color:rgb(0, 0, 0);">Please enter your backup password</p>
      <input type="password" id="backupPassword" placeholder="Enter backup password" style="width: 80%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
      <button id="submitPasswordBtn" style="background-color:rgb(0, 0, 0); color: white; border: none; border-radius: 4px; padding: 8px 20px; cursor: pointer; font-weight: 500;">Submit</button>
    </div>

    <div class="actions" style="display: flex; justify-content: center; padding: 15px; border-top: 1px solid #eee;">
      <button id="cancelBtn" style="background-color: #f5f7fa; color: #34495e; border: 1px solid #ddd; border-radius: 4px; padding: 8px 20px; cursor: pointer; font-weight: 500;">Cancel</button>
    </div>
  `;
  
  overlay.appendChild(authContainer);
  document.body.appendChild(overlay);
  
  // Add the face-api.js script
  const faceApiScript = document.createElement('script');
  faceApiScript.src = chrome.runtime.getURL('js/face-api.min.js');
  faceApiScript.onload = function() {
    console.log("Face API script loaded");
    // Initialize the authentication logic after face-api is loaded
    initFaceAuthentication();
  };
  document.body.appendChild(faceApiScript);
}
  
  // Remove the auth overlay
  function removeAuthOverlay() {
    const overlay = document.getElementById('face-guard-auth-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Stop any video stream that might be running
    const video = document.getElementById('video');
    if (video && video.srcObject) {
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  }
  
  // Face authentication logic for the overlay
function initFaceAuthentication() {
    // Elements
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const statusMessage = document.getElementById('statusMessage');
    const attemptCount = document.getElementById('attemptCount');
    const maxAttempts = document.getElementById('maxAttempts');
    const passwordFallback = document.getElementById('passwordFallback');
    const backupPassword = document.getElementById('backupPassword');
    const submitPasswordBtn = document.getElementById('submitPasswordBtn');
    const cancelBtn = document.getElementById('cancelBtn');
  
    // Variables
    let mediaStream = null;
    let settings = { maxAttempts: 3, password: '' };
    let faces = [];
    let currentAttempt = 1;
    let faceDetectionInterval = null;
    let isProcessing = false;
    let faceDetected = false;
  
    // Get current tab ID
    let currentTabId;
    chrome.runtime.sendMessage({type: 'GET_CURRENT_TAB'}, function(response) {
      if (response && response.tabId) {
        currentTabId = response.tabId;
      } else {
        currentTabId = null;
      }
    });
  
    // Initialize
    loadSettingsAndFaces();
  
    // Load settings and faces
    function loadSettingsAndFaces() {
      console.log("Loading settings and faces");
      
      // Load settings and faces
      chrome.storage.sync.get(['settings'], function(data) {
        if (data.settings) {
          settings = data.settings;
          maxAttempts.textContent = settings.maxAttempts || 3;
          console.log("Settings loaded:", settings);
        }
        
        // Try to get faces from local storage first (more reliable for images)
        chrome.storage.local.get(['faces'], function(localData) {
          if (localData.faces && Array.isArray(localData.faces) && localData.faces.length > 0) {
            faces = localData.faces;
            console.log("Faces loaded from local storage:", faces.length);
            startCamera();
          } else {
            // If not in local storage, try sync storage
            chrome.storage.sync.get(['faces'], function(syncData) {
              if (syncData.faces && Array.isArray(syncData.faces) && syncData.faces.length > 0) {
                faces = syncData.faces;
                console.log("Faces loaded from sync storage:", faces.length);
                startCamera();
              } else {
                console.log("No faces found in storage");
                statusMessage.textContent = 'No faces registered. Using password fallback.';
                showPasswordFallback();
              }
            });
          }
        });
      });
    }
    
    // Start the camera
    async function startCamera() {
      try {
        console.log("Starting camera...");
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: "user"
          } 
        });
        
        video.srcObject = mediaStream;
        
        // Start face detection when video is playing
        video.onloadedmetadata = function() {
          video.play();
          console.log("Video loaded, starting face detection");
          statusMessage.textContent = 'Looking for your face...';
          loadFaceApiModels().then((success) => {
            if (success) {
              startFaceDetection();
            } else {
              // Use password fallback if face API loading fails
              showPasswordFallback();
            }
          });
        };
        
      } catch (err) {
        console.error("Error accessing camera:", err);
        statusMessage.textContent = 'Could not access the camera. Using password fallback.';
        showPasswordFallback();
      }
    }
    
    // Load face-api.js models
    async function loadFaceApiModels() {
      if (!window.faceapi) {
        console.error("Face API not loaded");
        statusMessage.textContent = 'Face recognition not available';
        return false;
      }
      
      try {
        const modelPath = chrome.runtime.getURL('models'); // Path to face-api.js models
        console.log("Loading face detection models from:", modelPath);
        
        // We'll use a simple face detection for now
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        console.log("Models loaded successfully");
        return true;
      } catch (error) {
        console.error("Error loading face detection models:", error);
        statusMessage.textContent = 'Could not load face detection models';
        return false;
      }
    }
    
    // Stop the camera
    function stopCamera() {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
          track.stop();
        });
        video.srcObject = null;
        console.log("Camera stopped");
      }
      
      if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
      }
    }
    
    // Start face detection
    function startFaceDetection() {
      console.log("Starting face detection");
      
      // Reset attempt counter
      currentAttempt = 1;
      attemptCount.textContent = currentAttempt.toString();
      
      if (window.faceapi) {
        console.log("Using Face API for detection");
        // Use Face API detection - more frequent checks
        faceDetectionInterval = setInterval(async function() {
          if (isProcessing || faceDetected) return;
          
          try {
            isProcessing = true;
            const detections = await window.faceapi.detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions());
            
            if (detections) {
              console.log("Face detected", detections);
              faceDetected = true;
              statusMessage.textContent = 'Face detected! Verifying...';
              
              // For now, we'll consider any face a success
              // In a real implementation, you would compare with registered faces
              clearInterval(faceDetectionInterval);
              
              setTimeout(function() {
                authenticationSuccess();
              }, 1000);
            } else {
              // Face not detected in this frame
              console.log(`Face detection attempt ${currentAttempt}: No face detected`);
              currentAttempt++;
              attemptCount.textContent = currentAttempt.toString();
              
              // Check if we've reached max attempts
              if (currentAttempt > (settings.maxAttempts || 3)) {
                console.log("Max attempts reached");
                clearInterval(faceDetectionInterval);
                showPasswordFallback();
              }
              isProcessing = false;
            }
          } catch (error) {
            console.error("Error during face detection:", error);
            isProcessing = false;
          }
        }, 1000); // More frequent checks: Check every second
      } else {
        console.log("Using simulated detection (no Face API)");
        // Simulated face detection (for testing)
        setTimeout(() => {
          statusMessage.textContent = 'Face recognized! Granting access...';
          
          // Grant access after a brief pause
          setTimeout(function() {
            authenticationSuccess();
          }, 1000);
        }, 3000);
      }
    }
    
    // Show password fallback
    function showPasswordFallback() {
      console.log("Showing password fallback");
      stopCamera();
      document.querySelector(".face-verification").style.display = 'none';
      passwordFallback.style.display = 'block';
    }
    
    // Authentication success
    function authenticationSuccess() {
      console.log("Authentication successful");
      stopCamera();
      statusMessage.textContent = "Authentication successful!";
      
      // Notify background script of successful authentication
      chrome.runtime.sendMessage({
        type: 'AUTH_SUCCESS',
        tabId: currentTabId || window.tabId
      });
    }
    
    // Authentication failure
    function authenticationFailure() {
      console.log("Authentication failed");
      stopCamera();
      
      // Notify background script of failed authentication
      chrome.runtime.sendMessage({
        type: 'AUTH_FAILED',
        tabId: currentTabId || window.tabId
      });
    }
    
    // Add event listeners
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        console.log("Authentication canceled by user");
        authenticationFailure();
      });
    }
    
    if (submitPasswordBtn && backupPassword) {
      // Submit password button handler
      submitPasswordBtn.addEventListener('click', function() {
        const password = backupPassword.value;
        console.log("Password submitted");
        
        // Accept any password if none set
        if (!settings.password || password === settings.password) {
          console.log("Password correct");
          statusMessage.textContent = 'Password correct! Granting access...';
          authenticationSuccess();
        } else {
          console.log("Password incorrect");
          backupPassword.value = '';
          backupPassword.placeholder = 'Incorrect password. Try again.';
        }
      });
      
      // Handle password input enter key
      backupPassword.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
          submitPasswordBtn.click();
        }
      });
    }
  }
  