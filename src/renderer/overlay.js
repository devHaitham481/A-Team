/**
 * DipDip Overlay Window
 * Displays AI response with dismiss functionality
 */

const closeBtn = document.getElementById('closeBtn');
const loadingState = document.getElementById('loadingState');
const responseText = document.getElementById('responseText');

// Close button handler
closeBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.closeOverlay) {
    window.electronAPI.closeOverlay();
  }
});

// Listen for content updates from main process
if (window.electronAPI && window.electronAPI.onOverlayContent) {
  window.electronAPI.onOverlayContent((data) => {
    if (data.loading) {
      loadingState.classList.remove('hidden');
      responseText.classList.add('hidden');
    } else {
      loadingState.classList.add('hidden');
      responseText.classList.remove('hidden');

      if (data.error) {
        responseText.classList.add('error');
        responseText.textContent = `Error: ${data.error}`;
      } else {
        responseText.classList.remove('error');
        responseText.textContent = data.text || 'No response received.';
      }
    }
  });
}

// Keyboard shortcut to close (Escape)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (window.electronAPI && window.electronAPI.closeOverlay) {
      window.electronAPI.closeOverlay();
    }
  }
});
