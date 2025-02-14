// DOM Elements
const video = document.getElementById('webcam');
const startCameraBtn = document.getElementById('startCamera');
const togglePiPBtn = document.getElementById('togglePiP');
const errorMessage = document.getElementById('error-message');
const cameraStatus = document.getElementById('camera-status');
const pipStatus = document.getElementById('pip-status');

// State
let stream = null;
let isFlipped = false;

// Check Picture-in-Picture support
function isPiPSupported() {
    return !!(
        document.pictureInPictureEnabled ||
        document.webkitPictureInPictureEnabled ||
        document.mozPictureInPictureEnabled ||
        (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === 'function') // Safari
    );
}

// Error handling
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

// Check PiP support on page load
if (!isPiPSupported()) {
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    if (isFirefox) {
        showError('Picture-in-Picture button won\'t work on Firefox, but you can use Firefox\'s built-in PiP controls');
        togglePiPBtn.disabled = true;
        togglePiPBtn.style.display = 'none'; // Hide the PiP button since Firefox has its own
    } else {
        showError('Picture-in-Picture is not supported in your browser');
        togglePiPBtn.disabled = true;
        throw new Error('Picture-in-Picture is not supported in this browser');
    }
}

// Camera functions
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
        video.srcObject = stream;
        startCameraBtn.textContent = 'Stop Camera';
        togglePiPBtn.disabled = false;
        cameraStatus.textContent = 'Camera: On';
    } catch (err) {
        showError('Failed to access camera: ' + err.message);
        console.error('Error accessing camera:', err);
    }
}

function stopCamera() {
    if (stream) {
        // Exit PiP if active
        if (document.pictureInPictureElement ||
            document.webkitPictureInPictureElement ||
            document.mozPictureInPictureElement ||
            (video.webkitPresentationMode && video.webkitPresentationMode === 'picture-in-picture')) {
            
            if (document.exitPictureInPicture) {
                document.exitPictureInPicture();
            } else if (document.webkitExitPictureInPicture) {
                document.webkitExitPictureInPicture();
            } else if (document.mozExitPictureInPicture) {
                document.mozExitPictureInPicture();
            } else if (video.webkitPresentationMode) {
                video.webkitSetPresentationMode('inline');
            }
        }

        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
    }
    startCameraBtn.textContent = 'Start Camera';
    togglePiPBtn.disabled = true;
    cameraStatus.textContent = 'Camera: Off';
    pipStatus.textContent = 'PiP: Off';
    togglePiPBtn.textContent = 'Enter PiP';
}

// Picture in Picture functions
async function togglePiP() {
    try {
        // Check if currently in PiP mode
        const isInPiPMode = !!(
            document.pictureInPictureElement ||
            document.webkitPictureInPictureElement ||
            document.mozPictureInPictureElement ||
            (video.webkitPresentationMode && video.webkitPresentationMode === 'picture-in-picture')
        );

        if (isInPiPMode) {
            // Exit PiP based on browser
            if (document.exitPictureInPicture) {
                await document.exitPictureInPicture();
            } else if (document.webkitExitPictureInPicture) {
                await document.webkitExitPictureInPicture();
            } else if (document.mozExitPictureInPicture) {
                await document.mozExitPictureInPicture();
            } else if (video.webkitPresentationMode) {
                video.webkitSetPresentationMode('inline');
            }
            togglePiPBtn.textContent = 'Enter PiP';
            pipStatus.textContent = 'PiP: Off';
        } else {
            // Enter PiP based on browser
            if (document.pictureInPictureEnabled) {
                await video.requestPictureInPicture();
            } else if (document.webkitPictureInPictureEnabled) {
                await video.webkitRequestPictureInPicture();
            } else if (document.mozPictureInPictureEnabled) {
                await video.mozRequestPictureInPicture();
            } else if (video.webkitSupportsPresentationMode) {
                video.webkitSetPresentationMode('picture-in-picture');
            } else {
                throw new Error('Picture-in-Picture is not supported in this browser');
            }
            togglePiPBtn.textContent = 'Exit PiP';
            pipStatus.textContent = 'PiP: On';
        }
    } catch (err) {
        showError('PiP failed: ' + err.message);
        console.error('Error with PiP:', err);
    }
}

// Flip camera
function flipCamera() {
    isFlipped = !isFlipped;
    video.classList.toggle('flipped');
}

// Event listeners
startCameraBtn.addEventListener('click', () => {
    if (stream) {
        stopCamera();
    } else {
        startCamera();
    }
});

togglePiPBtn.addEventListener('click', togglePiP);

// Handle PiP changes for all browsers
const pipEvents = [
    'enterpictureinpicture',
    'leavepictureinpicture',
    'webkitenterpictureinpicture',
    'webkitleavepictureinpicture',
    'mozenterpictureinpicture',
    'mozleavepictureinpicture'
];

pipEvents.forEach(eventName => {
    video.addEventListener(eventName, (event) => {
        if (event.type.includes('enter')) {
            pipStatus.textContent = 'PiP: On';
            togglePiPBtn.textContent = 'Exit PiP';
        } else {
            pipStatus.textContent = 'PiP: Off';
            togglePiPBtn.textContent = 'Enter PiP';
        }
    });
});

// For Safari PiP
if (video.webkitSupportsPresentationMode) {
    video.addEventListener('webkitpresentationmodechanged', (event) => {
        const isInPiPMode = video.webkitPresentationMode === 'picture-in-picture';
        pipStatus.textContent = isInPiPMode ? 'PiP: On' : 'PiP: Off';
        togglePiPBtn.textContent = isInPiPMode ? 'Exit PiP' : 'Enter PiP';
    });
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopCamera();
});

// Start camera automatically when page loads
document.addEventListener('DOMContentLoaded', () => {
    startCamera();
});
