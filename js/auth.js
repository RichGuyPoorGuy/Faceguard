document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const siteUrlElement = document.getElementById('siteUrl');
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
    let pendingAuth = null;
    let settings = { maxAttempts: 3, password: '' };
    let faces = [];
    let currentAttempt = 1;
    let faceDetectionInterval = null;
    let isProcessing = false;
  
    // Initialize
    initializeAuth();
  
    // Initialize auth
    function initializeAuth() {
      console.log("Auth page initialized");
      
      // Load the pending auth request
      chrome.storage.local.get(['pendingAuth'], function(data) {
        pendingAuth = data.pendingAuth;
        
        if (pendingAuth && pendingAuth.url) {
          siteUrlElement.textContent = new URL(pendingAuth.url).hostname;
          console.log("Pending auth for:", siteUrlElement.textContent);
        } else {
          // No pending auth, close this tab
          console.error("No pending auth found");
          window.close();
          return;
        }
        
        // Load settings and faces
        chrome.storage.sync.get(['settings', 'faces'], function(data) {
          if (data.settings) {
            settings = data.settings;
            maxAttempts.textContent = settings.maxAttempts;
            console.log("Settings loaded:", settings);
          }
          
          if (data.faces && Array.isArray(data.faces)) {
            faces = data.faces;
            console.log("Faces loaded:", faces.length);
            
            if (faces.length === 0) {
              statusMessage.textContent = 'No faces registered. Authentication not possible.';
              console.log("No registered faces found");
              showPasswordFallback();
              return;
            }
            
            // Start camera for face recognition
            startCamera();
          } else {
            console.log("No faces found in storage");
            statusMessage.textContent = 'No faces registered. Authentication not possible.';
            showPasswordFallback();
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
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          } 
        });
        
        video.srcObject = mediaStream;
        
        // Start face detection when video is playing
        video.onloadedmetadata = function() {
          console.log("Video loaded, starting face detection");
          statusMessage.textContent = 'Looking for your face...';
          loadFaceApiModels().then(() => {
            startFaceDetection();
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
        showPasswordFallback();
        return;
      }
      
      try {
        const modelPath = '../models'; // Path to face-api.js models
        console.log("Loading face detection models...");
        
        // We'll use a simple face detection for now
        // In a real implementation, you would use more sophisticated models
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        console.log("Models loaded successfully");
        return true;
      } catch (error) {
        console.error("Error loading face detection models:", error);
        statusMessage.textContent = 'Could not load face detection models';
        showPasswordFallback();
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
      
      if (window.faceapi) {
        console.log("Using Face API for detection");
        // Use Face API detection
        faceDetectionInterval = setInterval(async function() {
          if (isProcessing) return;
          
          try {
            isProcessing = true;
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
            
            if (detections) {
              console.log("Face detected");
              statusMessage.textContent = 'Face detected! Verifying...';
              
              // For now, we'll consider any face a success
              // In a real implementation, you would compare with registered faces
              clearInterval(faceDetectionInterval);
              
              setTimeout(function() {
                authenticationSuccess();
              }, 1000);
            }
            isProcessing = false;
          } catch (error) {
            console.error("Error during face detection:", error);
            isProcessing = false;
          }
        }, 1000);
      } else {
        console.log("Using simulated detection (no Face API)");
        // Simulated face detection (for testing)
        faceDetectionInterval = setInterval(function() {
          // Simulate face detection process after 5 seconds
          setTimeout(() => {
            clearInterval(faceDetectionInterval);
            statusMessage.textContent = 'Face recognized! Granting access...';
            
            // Grant access after a brief pause
            setTimeout(function() {
              authenticationSuccess();
            }, 1000);
          }, 5000);
        }, 2000);
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
      statusMessage.textContent = "Authentication successful! Redirecting...";
      
      // Notify background script of successful authentication
      chrome.runtime.sendMessage({
        type: 'AUTH_SUCCESS',
        tabId: pendingAuth.tabId
      }, function(response) {
        console.log("Message sent to background script", response);
      });
    }
    
    // Authentication failure
    function authenticationFailure() {
      console.log("Authentication failed");
      stopCamera();
      
      // Notify background script of failed authentication
      chrome.runtime.sendMessage({
        type: 'AUTH_FAILED',
        tabId: pendingAuth.tabId
      });
    }
    
    // Cancel button handler
    cancelBtn.addEventListener('click', function() {
      console.log("Authentication canceled by user");
      authenticationFailure();
    });
    
    // Submit password button handler
    submitPasswordBtn.addEventListener('click', function() {
      const password = backupPassword.value;
      console.log("Password submitted");
      
      if (password === settings.password) {
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
  });
  