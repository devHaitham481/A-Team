/**
 * DipDip Screen Capture Module
 * Handles both recording and live streaming modes for screen capture
 */

// Module state
let currentStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let liveIntervalId = null;
let liveCanvas = null;
let liveContext = null;
let liveVideo = null;

/**
 * Get the full screen MediaStream
 * @returns {Promise<MediaStream>} The screen capture MediaStream
 * @throws {Error} If permission denied or no sources available
 */
async function getScreenStream() {
  try {
    // Check screen capture permission first (macOS)
    if (window.electronAPI && window.electronAPI.checkScreenCapturePermission) {
      const permissionStatus = await window.electronAPI.checkScreenCapturePermission();
      if (permissionStatus === 'denied') {
        throw new Error('Screen capture permission denied. Please enable in System Preferences.');
      }
    }

    // Get available screen sources from main process
    const sources = await window.electronAPI.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No screen sources available');
    }

    // Find the primary screen (usually named "Entire Screen" or "Screen 1")
    const screenSource = sources.find(source =>
      source.name.toLowerCase().includes('entire screen') ||
      source.name.toLowerCase().includes('screen 1') ||
      source.id.startsWith('screen:')
    ) || sources[0];

    // Get the video stream using the screen source
    const videoStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id,
          minWidth: 1280,
          maxWidth: 3840,
          minHeight: 720,
          maxHeight: 2160
        }
      }
    });

    // Get microphone audio stream
    let audioStream = null;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        },
        video: false
      });
    } catch (audioError) {
      console.warn('Could not get microphone audio:', audioError);
    }

    // Combine video and audio tracks
    const tracks = [...videoStream.getVideoTracks()];
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
    }

    const stream = new MediaStream(tracks);
    currentStream = stream;
    return stream;
  } catch (error) {
    console.error('Failed to get screen stream:', error);
    throw error;
  }
}

/**
 * Clean up the current stream
 */
function cleanupStream() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

// ============================================
// RECORDING MODE
// ============================================

/**
 * Start recording the screen
 * @returns {Promise<void>} Resolves when recording starts
 * @throws {Error} If recording cannot be started
 */
async function startRecording() {
  try {
    // Clean up any existing recording state
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder = null;
    }
    recordedChunks = [];

    // Get screen stream
    const stream = await getScreenStream();

    // Determine supported MIME type
    const mimeType = getSupportedMimeType();

    // Create MediaRecorder
    const options = mimeType ? { mimeType } : {};
    mediaRecorder = new MediaRecorder(stream, options);

    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // Handle errors
    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
    };

    // Start recording
    mediaRecorder.start(1000); // Collect data every second
    console.log('Recording started');

    return Promise.resolve();
  } catch (error) {
    console.error('Failed to start recording:', error);
    cleanupStream();
    throw error;
  }
}

/**
 * Stop recording and return the video Blob
 * @returns {Promise<Blob>} The recorded video as a Blob
 */
function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('No recording in progress'));
      return;
    }

    mediaRecorder.onstop = () => {
      try {
        // Combine chunks into a single Blob
        const mimeType = mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunks, { type: mimeType });

        // Clean up
        recordedChunks = [];
        mediaRecorder = null;
        cleanupStream();

        console.log('Recording stopped, blob size:', blob.size);
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    };

    mediaRecorder.onerror = (event) => {
      reject(event.error);
    };

    // Stop the recorder
    mediaRecorder.stop();
  });
}

/**
 * Send recording to API (stub implementation)
 * @param {Blob} blob - The video blob to send
 */
function sendRecording(blob) {
  console.log('Would send recording to API', blob.size);
}

/**
 * Get a supported MIME type for MediaRecorder
 * @returns {string|null} A supported MIME type or null
 */
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}

// ============================================
// LIVE STREAMING MODE
// ============================================

/**
 * Start live streaming, capturing frames at a configurable interval
 * @param {Function} frameCallback - Callback function called with each frame (base64 string)
 * @param {number} intervalMs - Interval between frame captures in milliseconds (default: 2000)
 * @returns {Promise<void>} Resolves when streaming starts
 */
async function startLiveStream(frameCallback, intervalMs = 2000) {
  try {
    // Stop any existing live stream
    stopLiveStream();

    // Get screen stream
    const stream = await getScreenStream();

    // Create video element to render stream
    liveVideo = document.createElement('video');
    liveVideo.srcObject = stream;
    liveVideo.muted = true;
    await liveVideo.play();

    // Create canvas for frame capture
    liveCanvas = document.createElement('canvas');
    liveContext = liveCanvas.getContext('2d');

    // Set canvas size to match video
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    liveCanvas.width = settings.width || 1920;
    liveCanvas.height = settings.height || 1080;

    // Start interval for frame capture
    liveIntervalId = setInterval(() => {
      captureFrame(frameCallback);
    }, intervalMs);

    // Capture first frame immediately
    captureFrame(frameCallback);

    console.log(`Live stream started with ${intervalMs}ms interval`);
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to start live stream:', error);
    stopLiveStream();
    throw error;
  }
}

/**
 * Capture a single frame and pass it to the callback
 * @param {Function} callback - Function to call with frame data
 */
function captureFrame(callback) {
  if (!liveVideo || !liveCanvas || !liveContext) {
    console.warn('Live stream not initialized');
    return;
  }

  try {
    // Draw current video frame to canvas
    liveContext.drawImage(liveVideo, 0, 0, liveCanvas.width, liveCanvas.height);

    // Convert to base64
    const frameData = liveCanvas.toDataURL('image/jpeg', 0.8);

    // Call the callback with frame data
    if (typeof callback === 'function') {
      callback(frameData);
    }
  } catch (error) {
    console.error('Error capturing frame:', error);
  }
}

/**
 * Stop the live stream
 */
function stopLiveStream() {
  // Clear interval
  if (liveIntervalId) {
    clearInterval(liveIntervalId);
    liveIntervalId = null;
  }

  // Clean up video element
  if (liveVideo) {
    liveVideo.pause();
    liveVideo.srcObject = null;
    liveVideo = null;
  }

  // Clean up canvas
  liveCanvas = null;
  liveContext = null;

  // Clean up stream
  cleanupStream();

  console.log('Live stream stopped');
}

/**
 * Send frame to API (stub implementation)
 * @param {string} frameData - The frame data (base64 string) to send
 */
function sendFrame(frameData) {
  const sizeKB = Math.round((frameData.length * 3) / 4 / 1024);
  console.log('Would send frame to API', `~${sizeKB}KB`);
}

// ============================================
// EXPORTS
// ============================================

export {
  // Shared
  getScreenStream,

  // Recording mode
  startRecording,
  stopRecording,
  sendRecording,

  // Live mode
  startLiveStream,
  stopLiveStream,
  sendFrame
};
