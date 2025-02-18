// DOM Elements
const video = document.getElementById('webcam');
const screenVideo = document.getElementById('screen-video');
const canvas = document.getElementById('combined-canvas');
const ctx = canvas.getContext('2d');
const startCameraBtn = document.getElementById('startCamera');
const togglePiPBtn = document.getElementById('togglePiP');
const startScreenBtn = document.getElementById('startScreen');
const layoutSelect = document.getElementById('layoutSelect');
const swapPositionsBtn = document.getElementById('swapPositions');
const errorMessage = document.getElementById('error-message');
const cameraStatus = document.getElementById('camera-status');
const pipStatus = document.getElementById('pip-status');
const screenStatus = document.getElementById('screen-status');
const screenContainer = document.querySelector('.screen-container');
const toggleRecordingBtn = document.getElementById('toggleRecording');
const recordingStatus = document.getElementById('recording-status');
const canvasVideo = document.getElementById('canvas-video');

// State
let stream = null;
let screenStream = null;
let isFlipped = false;
let animationFrameId = null;
let currentLayout = 'pip';
let isSwapped = false;
let mediaRecorder = null;
let recordedChunks = [];
let canvasStream = null;

// Set canvas size
function setCanvasSize() {
    const width = screenContainer.clientWidth;
    const height = width * (9/16); // 16:9 aspect ratio
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'block';
    canvasVideo.style.display = 'block';
}

// Helper function to calculate dimensions maintaining aspect ratio
function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
        width: srcWidth * ratio,
        height: srcHeight * ratio
    };
}

// Draw combined video frames
function drawVideoFrame() {
    if (!screenStream && !stream) {
        cancelAnimationFrame(animationFrameId);
        return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mainVideo = isSwapped ? video : screenVideo;
    const overlayVideo = isSwapped ? screenVideo : video;
    const mainStream = isSwapped ? stream : screenStream;
    const overlayStream = isSwapped ? screenStream : stream;

    switch (currentLayout) {
        case 'pip':
            // Draw main video
            if (mainStream && mainVideo.readyState === 4) {
                const mainDims = calculateAspectRatioFit(
                    mainVideo.videoWidth,
                    mainVideo.videoHeight,
                    canvas.width,
                    canvas.height
                );
                
                // Center the video
                const x = (canvas.width - mainDims.width) / 2;
                const y = (canvas.height - mainDims.height) / 2;
                ctx.drawImage(mainVideo, x, y, mainDims.width, mainDims.height);
            }

            // Draw overlay video
            if (overlayStream && overlayVideo.readyState === 4) {
                const pipWidth = canvas.width * 0.25;
                const pipHeight = (overlayVideo.videoHeight / overlayVideo.videoWidth) * pipWidth;
                const pipX = canvas.width - pipWidth - 20;
                const pipY = canvas.height - pipHeight - 20;

                if (isFlipped && !isSwapped) {
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.drawImage(overlayVideo, -pipX - pipWidth, pipY, pipWidth, pipHeight);
                    ctx.restore();
                } else {
                    ctx.drawImage(overlayVideo, pipX, pipY, pipWidth, pipHeight);
                }
            }
            break;

        case 'sideBySide':
            const halfWidth = canvas.width / 2 - 5;
            
            // Draw left video
            if (mainStream && mainVideo.readyState === 4) {
                const leftDims = calculateAspectRatioFit(
                    mainVideo.videoWidth,
                    mainVideo.videoHeight,
                    halfWidth,
                    canvas.height
                );
                const leftY = (canvas.height - leftDims.height) / 2;
                ctx.drawImage(mainVideo, 0, leftY, leftDims.width, leftDims.height);
            }

            // Draw right video
            if (overlayStream && overlayVideo.readyState === 4) {
                const rightDims = calculateAspectRatioFit(
                    overlayVideo.videoWidth,
                    overlayVideo.videoHeight,
                    halfWidth,
                    canvas.height
                );
                const rightX = canvas.width / 2 + 5;
                const rightY = (canvas.height - rightDims.height) / 2;

                if (isFlipped && !isSwapped) {
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.drawImage(overlayVideo, -canvas.width + 5, rightY, rightDims.width, rightDims.height);
                    ctx.restore();
                } else {
                    ctx.drawImage(overlayVideo, rightX, rightY, rightDims.width, rightDims.height);
                }
            }
            break;

        case 'stackedVertical':
            const halfHeight = canvas.height / 2 - 5;
            
            // Draw top video
            if (mainStream && mainVideo.readyState === 4) {
                const topDims = calculateAspectRatioFit(
                    mainVideo.videoWidth,
                    mainVideo.videoHeight,
                    canvas.width,
                    halfHeight
                );
                const topX = (canvas.width - topDims.width) / 2;
                ctx.drawImage(mainVideo, topX, 0, topDims.width, topDims.height);
            }

            // Draw bottom video
            if (overlayStream && overlayVideo.readyState === 4) {
                const bottomDims = calculateAspectRatioFit(
                    overlayVideo.videoWidth,
                    overlayVideo.videoHeight,
                    canvas.width,
                    halfHeight
                );
                const bottomX = (canvas.width - bottomDims.width) / 2;
                const bottomY = canvas.height / 2 + 5;

                if (isFlipped && !isSwapped) {
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.drawImage(overlayVideo, -canvas.width + bottomX, bottomY, bottomDims.width, bottomDims.height);
                    ctx.restore();
                } else {
                    ctx.drawImage(overlayVideo, bottomX, bottomY, bottomDims.width, bottomDims.height);
                }
            }
            break;
    }

    // Ensure canvas stream is set up
    setupCanvasStream();

    // Request next frame
    animationFrameId = requestAnimationFrame(drawVideoFrame);
}

// Screen sharing functions
async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });
        
        screenVideo.srcObject = screenStream;
        screenContainer.classList.remove('hidden');
        startScreenBtn.textContent = 'Stop Sharing';
        screenStatus.textContent = 'Screen: On';

        // Set canvas size and start drawing
        setCanvasSize();
        drawVideoFrame();
        setupCanvasStream(); // Ensure canvas stream is set up

        // Handle stream ending (user stops sharing)
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
            stopScreenShare();
        });
    } catch (err) {
        showError('Failed to start screen sharing: ' + err.message);
        console.error('Error starting screen share:', err);
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenVideo.srcObject = null;
        screenStream = null;
        screenContainer.classList.add('hidden');
        startScreenBtn.textContent = 'Share Screen';
        screenStatus.textContent = 'Screen: Off';
        
        if (!stream) {
            cancelAnimationFrame(animationFrameId);
        }
    }
}

// Modified camera functions
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

        if (screenStream) {
            setCanvasSize();
            drawVideoFrame();
            setupCanvasStream(); // Ensure canvas stream is set up
        }
    } catch (err) {
        showError('Failed to access camera: ' + err.message);
        console.error('Error accessing camera:', err);
    }
}

function stopCamera() {
    if (stream) {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
        }

        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;

        if (!screenStream) {
            cancelAnimationFrame(animationFrameId);
        }
    }
    startCameraBtn.textContent = 'Start Camera';
    togglePiPBtn.disabled = true;
    cameraStatus.textContent = 'Camera: Off';
    pipStatus.textContent = 'PiP: Off';
    togglePiPBtn.textContent = 'Enter PiP';
}

// Flip camera
function flipCamera() {
    isFlipped = !isFlipped;
}

// Event listeners
startScreenBtn.addEventListener('click', () => {
    if (screenStream) {
        stopScreenShare();
    } else {
        startScreenShare();
    }
});

startCameraBtn.addEventListener('click', () => {
    if (stream) {
        stopCamera();
    } else {
        startCamera();
    }
});

// Event listeners for layout controls
layoutSelect.addEventListener('change', (e) => {
    currentLayout = e.target.value;
});

swapPositionsBtn.addEventListener('click', () => {
    isSwapped = !isSwapped;
});

// Handle window resize
window.addEventListener('resize', () => {
    if (screenStream || stream) {
        setCanvasSize();
    }
});

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

// Modified togglePiP function to use canvas
async function togglePiP() {
    try {
        const isInPiPMode = document.pictureInPictureElement;

        if (isInPiPMode) {
            await document.exitPictureInPicture();
            togglePiPBtn.textContent = 'Enter PiP';
            pipStatus.textContent = 'PiP: Off';
        } else {
            await canvasVideo.requestPictureInPicture();
            togglePiPBtn.textContent = 'Exit PiP';
            pipStatus.textContent = 'PiP: On';
        }
    } catch (err) {
        showError('PiP failed: ' + err.message);
        console.error('Error with PiP:', err);
    }
}

// Handle PiP changes
canvasVideo.addEventListener('enterpictureinpicture', () => {
    pipStatus.textContent = 'PiP: On';
    togglePiPBtn.textContent = 'Exit PiP';
});

canvasVideo.addEventListener('leavepictureinpicture', () => {
    pipStatus.textContent = 'PiP: Off';
    togglePiPBtn.textContent = 'Enter PiP';
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopCamera();
});

// Start camera automatically when page loads
document.addEventListener('DOMContentLoaded', () => {
    startCamera();
});

// Add this function to create the canvas stream
function createCanvasStream() {
    if (!canvasStream) {
        canvasStream = canvas.captureStream(30); // 30 FPS
        
        // Add audio if needed from webcam
        if (stream && stream.getAudioTracks().length > 0) {
            const audioTrack = stream.getAudioTracks()[0];
            canvasStream.addTrack(audioTrack);
        }
    }
    return canvasStream;
}

// Add recording functions
function startRecording() {
    const stream = createCanvasStream();
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, {
            type: 'video/webm'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = 'canvas-recording.webm';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    mediaRecorder.start(1000); // Make data available every 1 second
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

// Clean up function modification
function cleanup() {
    if (canvasStream) {
        canvasStream.getTracks().forEach(track => track.stop());
        canvasStream = null;
    }
    stopRecording();
    stopCamera();
    stopScreenShare();
}

// Update the beforeunload handler
window.addEventListener('beforeunload', cleanup);

// Add the recording event listener
toggleRecordingBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        stopRecording();
        toggleRecordingBtn.textContent = 'Start Recording';
        recordingStatus.textContent = 'Recording: Off';
    } else {
        startRecording();
        toggleRecordingBtn.textContent = 'Stop Recording';
        recordingStatus.textContent = 'Recording: On';
    }
});

// Add this function to create and set up canvas stream
function setupCanvasStream() {
    if (!canvasStream) {
        canvasStream = canvas.captureStream(30); // 30 FPS
        canvasVideo.srcObject = canvasStream;
        canvasVideo.play().catch(err => {
            console.error('Error playing canvas video:', err);
        });
    }
}
