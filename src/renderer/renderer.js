/**
 * DipDip Renderer Process
 * Handles the UI logic for the floating pill widget
 */

import {
  getScreenStream,
  startRecording as captureStartRecording,
  stopRecording as captureStopRecording
} from './capture.js';

// State management
let isRecording = false;
let isLive = false;
let isAskAI = false;
let isReplying = false;
let lastRecordingBlob = null;

// DOM element references
let recordButton = null;
let liveButton = null;
let askaiButton = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DipDip renderer initialized');

  // Initialize the pill UI
  initPill();

  // Setup IPC listeners for hotkey triggers from main process
  setupIPCListeners();
});

/**
 * Initialize the pill widget
 */
function initPill() {
  // Get references to UI elements
  const pillContainer = document.querySelector('.pill-container');
  recordButton = document.querySelector('.record-button');
  liveButton = document.querySelector('.live-button');
  askaiButton = document.querySelector('.askai-button');

  // Add subtle entrance animation
  pillContainer.style.opacity = '0';
  pillContainer.style.transform = 'scale(0.95)';

  requestAnimationFrame(() => {
    pillContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    pillContainer.style.opacity = '1';
    pillContainer.style.transform = 'scale(1)';
  });

  // Setup click handlers for buttons
  setupButtonHandlers();
}

/**
 * Setup click handlers for mode buttons
 */
function setupButtonHandlers() {
  if (recordButton) {
    recordButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRecord();
    });
  }

  if (liveButton) {
    liveButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLive();
    });
  }

  if (askaiButton) {
    askaiButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAskAI();
    });
  }
}

/**
 * Setup IPC listeners for main process communication
 */
function setupIPCListeners() {
  // Check if electronAPI is available (exposed via preload script)
  if (window.electronAPI) {
    // Listen for toggle-record command from main process (via hotkey)
    window.electronAPI.receive('toggle-record', () => {
      toggleRecord();
    });

    // Listen for toggle-live command from main process (via hotkey)
    window.electronAPI.receive('toggle-live', () => {
      toggleLive();
    });

    // Listen for toggle-askai command from main process (via hotkey)
    window.electronAPI.receive('toggle-askai', () => {
      toggleAskAI();
    });

    // Listen for start-reply command from overlay
    window.electronAPI.receive('start-reply', () => {
      startReply();
    });

    // Listen for stop-reply command from overlay
    window.electronAPI.receive('stop-reply', () => {
      stopReply();
    });
  } else {
    console.log('electronAPI not available - IPC listeners not set up');
  }
}

/**
 * Toggle recording mode
 */
function toggleRecord() {
  if (isRecording) {
    // Stop recording
    stopRecording();
    isRecording = false;
  } else {
    // If live is active, stop it first (mutually exclusive)
    if (isLive) {
      stopLive();
      isLive = false;
      updateButtonState(liveButton, false);
    }
    // If Ask AI is active, stop it first
    if (isAskAI) {
      stopAskAI();
      isAskAI = false;
      updateButtonState(askaiButton, false);
    }
    // Start recording
    startRecording();
    isRecording = true;
  }

  // Update visual state
  updateButtonState(recordButton, isRecording);
  console.log(`Recording: ${isRecording ? 'ON' : 'OFF'}`);
}

/**
 * Toggle live mode
 */
function toggleLive() {
  if (isLive) {
    // Stop live
    stopLive();
    isLive = false;
  } else {
    // If recording is active, stop it first (mutually exclusive)
    if (isRecording) {
      stopRecording();
      isRecording = false;
      updateButtonState(recordButton, false);
    }
    // If Ask AI is active, stop it first
    if (isAskAI) {
      stopAskAI();
      isAskAI = false;
      updateButtonState(askaiButton, false);
    }
    // Start live
    startLive();
    isLive = true;
  }

  // Update visual state
  updateButtonState(liveButton, isLive);
  console.log(`Live: ${isLive ? 'ON' : 'OFF'}`);
}

/**
 * Toggle Ask AI mode
 */
function toggleAskAI() {
  if (isAskAI) {
    // Stop Ask AI recording and process
    stopAskAI();
    isAskAI = false;
  } else {
    // If recording is active, stop it first (mutually exclusive)
    if (isRecording) {
      stopRecording();
      isRecording = false;
      updateButtonState(recordButton, false);
    }
    // If live is active, stop it first
    if (isLive) {
      stopLive();
      isLive = false;
      updateButtonState(liveButton, false);
    }
    // Start Ask AI recording
    startAskAI();
    isAskAI = true;
  }

  // Update visual state
  updateButtonState(askaiButton, isAskAI);
  console.log(`Ask AI: ${isAskAI ? 'ON' : 'OFF'}`);
}

/**
 * Update button visual state
 * @param {Element} button - Button element to update
 * @param {boolean} active - Whether the button is active
 */
function updateButtonState(button, active) {
  if (button) {
    button.setAttribute('data-active', active.toString());
  }
}

/**
 * Start recording using the capture module
 */
async function startRecording() {
  console.log('Starting recording...');
  try {
    await captureStartRecording();
    console.log('Recording started successfully');
  } catch (error) {
    console.error('Failed to start recording:', error);
    // Reset state on failure
    isRecording = false;
    updateButtonState(recordButton, false);
  }
}

/**
 * Convert blob to base64 string
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      console.log('Data URL length:', dataUrl.length);
      console.log('Data URL preview:', dataUrl.substring(0, 100));
      // Find the base64 marker and extract data after it
      const base64Marker = ';base64,';
      const base64Index = dataUrl.indexOf(base64Marker);
      if (base64Index === -1) {
        reject(new Error('Invalid data URL format'));
        return;
      }
      const base64 = dataUrl.substring(base64Index + base64Marker.length);
      console.log('Extracted base64 length:', base64.length);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Set loading state on record button
 * @param {boolean} loading
 */
function setLoadingState(loading) {
  if (recordButton) {
    recordButton.setAttribute('data-loading', loading.toString());
  }
}

/**
 * Show success state briefly
 */
function showSuccess() {
  if (recordButton) {
    recordButton.setAttribute('data-success', 'true');
    setTimeout(() => {
      recordButton.setAttribute('data-success', 'false');
    }, 1500);
  }
}

/**
 * Stop recording using the capture module
 */
async function stopRecording() {
  console.log('Stopping recording...');
  try {
    const blob = await captureStopRecording();
    lastRecordingBlob = blob;
    console.log('Recording stopped, blob size:', blob.size);

    // Save video and copy to clipboard immediately for easy attachment to LLMs
    const arrayBuffer = await blob.arrayBuffer();
    const mimeType = blob.type.split(';')[0];
    const saveResult = await window.electronAPI.saveAndCopyVideo(
      Array.from(new Uint8Array(arrayBuffer)),
      mimeType
    );
    if (saveResult.success) {
      console.log('Video saved and copied to clipboard:', saveResult.filepath);
    } else {
      console.error('Failed to save video:', saveResult.error);
    }

    // Show loading state for transcription
    setLoadingState(true);

    // Convert blob to base64 and send to Gemini
    console.log('Transcribing with Gemini...');
    const base64Data = await blobToBase64(blob);
    const result = await window.electronAPI.transcribe(base64Data, mimeType);

    // Hide loading state
    setLoadingState(false);

    if (result.success) {
      console.log('Transcription:', result.text);
      // Video remains in clipboard for LLM attachment
      // Show success animation
      showSuccess();
    } else {
      console.error('Transcription failed:', result.error);
      // Still show success since video was saved and copied
      showSuccess();
    }
  } catch (error) {
    console.error('Failed to stop recording:', error);
    setLoadingState(false);
  }
}

/**
 * Set loading state on live button
 * @param {boolean} loading
 */
function setLiveLoadingState(loading) {
  if (liveButton) {
    liveButton.setAttribute('data-loading', loading.toString());
  }
}

/**
 * Start live mode using Gemini Live API
 */
async function startLive() {
  console.log('Starting Gemini Live mode...');
  setLiveLoadingState(true);

  try {
    const result = await window.electronAPI.startGeminiLive({ pushToTalk: false });

    setLiveLoadingState(false);

    if (result.success) {
      console.log('Gemini Live started:', result.message);
    } else {
      console.error('Failed to start Gemini Live:', result.error);
      isLive = false;
      updateButtonState(liveButton, false);
    }
  } catch (error) {
    console.error('Failed to start Gemini Live:', error);
    setLiveLoadingState(false);
    isLive = false;
    updateButtonState(liveButton, false);
  }
}

/**
 * Stop live mode using Gemini Live API
 */
async function stopLive() {
  console.log('Stopping Gemini Live mode...');

  try {
    const result = await window.electronAPI.stopGeminiLive();

    if (result.success) {
      console.log('Gemini Live stopped:', result.message);
    } else {
      console.error('Failed to stop Gemini Live:', result.error);
    }
  } catch (error) {
    console.error('Failed to stop Gemini Live:', error);
  }
}

/**
 * Set loading state on Ask AI button
 * @param {boolean} loading
 */
function setAskAILoadingState(loading) {
  if (askaiButton) {
    askaiButton.setAttribute('data-loading', loading.toString());
  }
}

/**
 * Show success state briefly on Ask AI button
 */
function showAskAISuccess() {
  if (askaiButton) {
    askaiButton.setAttribute('data-success', 'true');
    setTimeout(() => {
      askaiButton.setAttribute('data-success', 'false');
    }, 1500);
  }
}

/**
 * Start Ask AI mode - begins recording
 */
async function startAskAI() {
  console.log('Starting Ask AI recording...');
  try {
    await captureStartRecording();
    console.log('Ask AI recording started successfully');
  } catch (error) {
    console.error('Failed to start Ask AI recording:', error);
    isAskAI = false;
    updateButtonState(askaiButton, false);
  }
}

/**
 * Stop Ask AI mode - stops recording and sends to Gemini, shows overlay
 */
async function stopAskAI() {
  console.log('Stopping Ask AI recording...');
  try {
    const blob = await captureStopRecording();
    console.log('Ask AI recording stopped, blob size:', blob.size);

    // Show loading state on button
    setAskAILoadingState(true);

    // Show loading overlay
    await window.electronAPI.showOverlay({ loading: true });

    // Convert blob to base64 and send to Gemini
    console.log('Sending to Gemini for analysis...');
    const base64Data = await blobToBase64(blob);
    const mimeType = blob.type.split(';')[0];
    const result = await window.electronAPI.transcribe(base64Data, mimeType);

    // Hide loading state
    setAskAILoadingState(false);

    if (result.success) {
      console.log('Gemini response:', result.text);
      // Update overlay with response
      await window.electronAPI.showOverlay({ loading: false, text: result.text });
      showAskAISuccess();
    } else {
      console.error('Gemini analysis failed:', result.error);
      // Show error in overlay
      await window.electronAPI.showOverlay({ loading: false, error: result.error });
    }
  } catch (error) {
    console.error('Failed to stop Ask AI recording:', error);
    setAskAILoadingState(false);
    await window.electronAPI.showOverlay({ loading: false, error: error.message });
  }
}

/**
 * Start reply recording (triggered from overlay)
 */
async function startReply() {
  console.log('Starting reply recording...');

  // Stop other modes if active
  if (isRecording) {
    await captureStopRecording();
    isRecording = false;
    updateButtonState(recordButton, false);
  }
  if (isLive) {
    stopLive();
    isLive = false;
    updateButtonState(liveButton, false);
  }
  if (isAskAI) {
    // Don't stop - just note we're in reply mode now
    isAskAI = false;
    updateButtonState(askaiButton, false);
  }

  try {
    await captureStartRecording();
    isReplying = true;
    // Notify overlay that recording has started
    window.electronAPI.replyStateChange({ recording: true });
    console.log('Reply recording started successfully');
  } catch (error) {
    console.error('Failed to start reply recording:', error);
    window.electronAPI.replyStateChange({ recording: false, error: error.message });
  }
}

/**
 * Stop reply recording and send with context
 */
async function stopReply() {
  if (!isReplying) {
    console.log('Not in reply mode, ignoring stop');
    return;
  }

  console.log('Stopping reply recording...');
  try {
    const blob = await captureStopRecording();
    isReplying = false;
    console.log('Reply recording stopped, blob size:', blob.size);

    // Notify overlay that we're processing
    window.electronAPI.replyStateChange({ recording: false, loading: true });

    // Show loading in overlay
    await window.electronAPI.showOverlay({ loading: true });

    // Convert blob to base64 and send to Gemini with context
    console.log('Sending reply to Gemini with context...');
    const base64Data = await blobToBase64(blob);
    const mimeType = blob.type.split(';')[0];
    const result = await window.electronAPI.transcribeWithContext(base64Data, mimeType);

    // Notify overlay loading complete
    window.electronAPI.replyStateChange({ recording: false, loading: false });

    if (result.success) {
      console.log('Gemini reply response:', result.text);
      // Update overlay with response
      await window.electronAPI.showOverlay({ loading: false, text: result.text });
    } else {
      console.error('Gemini reply failed:', result.error);
      await window.electronAPI.showOverlay({ loading: false, error: result.error });
    }
  } catch (error) {
    console.error('Failed to stop reply recording:', error);
    isReplying = false;
    window.electronAPI.replyStateChange({ recording: false, loading: false, error: error.message });
    await window.electronAPI.showOverlay({ loading: false, error: error.message });
  }
}

/**
 * Get current state
 * @returns {Object} Current state of recording, live, and Ask AI modes
 */
function getState() {
  return {
    isRecording,
    isLive,
    isAskAI
  };
}

/**
 * Get the last recorded blob
 * @returns {Blob|null} The last recording blob or null if none
 */
function getLastRecording() {
  return lastRecordingBlob;
}

// Expose functions for external use (e.g., from main process via IPC)
window.dipDip = {
  toggleRecord,
  toggleLive,
  toggleAskAI,
  getState,
  startRecording,
  stopRecording,
  startLive,
  stopLive,
  startAskAI,
  stopAskAI,
  getLastRecording,
  getScreenStream
};
