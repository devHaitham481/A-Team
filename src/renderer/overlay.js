/**
 * DipDip Overlay Window
 * Displays AI response with dismiss functionality
 */

const closeBtn = document.getElementById('closeBtn');
const loadingState = document.getElementById('loadingState');
const responseText = document.getElementById('responseText');

/**
 * Simple markdown parser for common formatting
 * Handles: bold, italic, code, headings, lists, links
 */
function parseMarkdown(text) {
  if (!text) return '';

  // Normalize line endings and trim each line's leading/trailing whitespace
  let lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
  let normalized = lines.join('\n');

  // Escape HTML to prevent XSS
  let html = normalized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings (### ## #)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Numbered lists (1. 2. 3.)
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');

  // Bullet lists (- or *) - must be at start of line
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Clean up: remove newlines inside <ul> tags
  html = html.replace(/<ul>([\s\S]*?)<\/ul>/g, (match, content) => {
    return '<ul>' + content.replace(/\n/g, '') + '</ul>';
  });

  // Convert remaining newlines to spaces (flow text naturally)
  html = html.replace(/\n/g, ' ');

  // Clean up multiple spaces
  html = html.replace(/\s+/g, ' ');

  // Add breaks between major sections (after </ul>, </h1>, etc.)
  html = html.replace(/(<\/ul>|<\/ol>|<\/h[1-3]>|<\/pre>)\s*/g, '$1<br>');

  return html.trim();
}

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
        responseText.innerHTML = parseMarkdown(data.text) || 'No response received.';
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
