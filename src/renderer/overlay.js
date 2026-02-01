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

  // Escape HTML to prevent XSS
  let html = text
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

  // Italic (*text* or _text_) - but not inside words
  html = html.replace(/(?<![\\w])\*([^*]+)\*(?![\\w])/g, '<em>$1</em>');
  html = html.replace(/(?<![\\w])_([^_]+)_(?![\\w])/g, '<em>$1</em>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Numbered lists (1. 2. 3.)
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="numbered">$2</li>');

  // Bullet lists (- or *)
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> elements in <ul> or <ol>
  html = html.replace(/(<li class="numbered">[\s\S]*?<\/li>)(\n(?!<li)|\n?$)/g, '<ol>$1</ol>$2');
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n(?!<li)|\n?$)/g, '<ul>$1</ul>$2');

  // Clean up nested list issues
  html = html.replace(/<\/ol>\n<ol>/g, '\n');
  html = html.replace(/<\/ul>\n<ul>/g, '\n');
  html = html.replace(/<li class="numbered">/g, '<li>');

  // Only convert double line breaks to paragraph breaks (not single)
  html = html.replace(/\n\n+/g, '<br><br>');

  // Remove single line breaks (let text flow naturally)
  html = html.replace(/([^>])\n([^<])/g, '$1 $2');

  return html;
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
