import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';

export class SectionWidget extends BaseLatexWidget {
  toDOM(view: EditorView): HTMLElement {
    const level = this.token.level || 1;
    const content = this.token.content || '';
    const sectionName = this.token.name || `${'sub'.repeat(level - 1)}section`;

    if (this.showCommands) {
      const wrapper = document.createElement('div');
      wrapper.className = `latex-visual-section-command latex-visual-section-${level}`;

      const prefix = document.createElement('span');
      prefix.className = 'latex-cmd-prefix';
      prefix.textContent = `\\${sectionName}{`;
      prefix.style.color = '#007acc';
      prefix.style.fontWeight = '600';
      prefix.style.fontFamily = 'monospace';

      const contentSpan = document.createElement('span');
      contentSpan.className = 'latex-cmd-content';
      contentSpan.textContent = content;
      contentSpan.style.fontWeight = 'bold';

      this.makeEditable(contentSpan, view, (newContent) => {
        if (newContent !== content) {
          const newLatex = `\\${sectionName}{${newContent}}`;
          this.updateTokenInEditor(view, newLatex);
        }
      });

      const suffix = document.createElement('span');
      suffix.className = 'latex-cmd-suffix';
      suffix.textContent = '}';
      suffix.style.color = '#007acc';
      suffix.style.fontWeight = '600';
      suffix.style.fontFamily = 'monospace';

      wrapper.appendChild(prefix);
      wrapper.appendChild(contentSpan);
      wrapper.appendChild(suffix);

      wrapper.style.background = 'rgba(0, 123, 255, 0.1)';
      wrapper.style.borderLeft = '4px solid #007acc';
      wrapper.style.padding = '8px 12px';
      wrapper.style.margin = '20px 0 10px 0';
      wrapper.style.borderRadius = '4px';

      return wrapper;
    }

    const heading = document.createElement('div');
    heading.className = `latex-visual-section latex-visual-section-${level}`;
    heading.setAttribute('role', 'heading');
    heading.setAttribute('aria-level', level.toString());
    heading.textContent = content;
    heading.style.margin = '1em 0 0.5em 0';
    heading.style.borderBottom = '1px solid #ddd';
    heading.style.paddingBottom = '0.2em';
    heading.style.fontWeight = 'bold';
    heading.style.display = 'block';
    heading.style.outline = 'none';
    heading.style.cursor = 'text';
    heading.contentEditable = 'true';

    // Apply heading-specific styling based on level
    switch (level) {
      case 1:
        heading.style.fontSize = '2em';
        break;
      case 2:
        heading.style.fontSize = '1.5em';
        break;
      case 3:
        heading.style.fontSize = '1.17em';
        break;
      default:
        heading.style.fontSize = '1em';
    }

    // Force text selection to work
    heading.style.userSelect = 'text';

    // Comprehensive event capturing
    const events = [
      'mousedown', 'mouseup', 'click', 'dblclick',
      'keydown', 'keyup', 'keypress', 'input',
      'focus', 'blur', 'select', 'selectstart'
    ];

    events.forEach(eventType => {
      heading.addEventListener(eventType, (e) => {
        e.stopImmediatePropagation();

        // Allow default behavior for text editing events
        if (!['mousedown', 'click'].includes(eventType)) {
          return;
        }

        // For mouse events, ensure proper focus and selection
        if (eventType === 'mousedown' || eventType === 'click') {
          e.preventDefault();

          // Force focus
          setTimeout(() => {
            heading.focus();

            // Try to set cursor position
            try {
              const selection = window.getSelection();
              const range = document.createRange();

              if (heading.firstChild && heading.firstChild.nodeType === Node.TEXT_NODE) {
                const textNode = heading.firstChild;
                const text = textNode.textContent || '';

                // Calculate approximate cursor position from mouse click
                const rect = heading.getBoundingClientRect();
                const relativeX = (e as MouseEvent).clientX - rect.left;
                const totalWidth = rect.width;
                const charIndex = Math.round((relativeX / totalWidth) * text.length);
                const clampedIndex = Math.max(0, Math.min(charIndex, text.length));

                range.setStart(textNode, clampedIndex);
                range.setEnd(textNode, clampedIndex);

                selection?.removeAllRanges();
                selection?.addRange(range);
              }
            } catch (error) {
              console.warn('Could not set cursor position:', error);
            }
          }, 0);
        }
      }, true); // Use capture phase
    });

    // Handle content changes
    heading.addEventListener('blur', () => {
      const newContent = heading.textContent || '';
      if (newContent !== content) {
        const newLatex = `\\${sectionName}{${newContent}}`;
        this.updateTokenInEditor(view, newLatex);
      }
    });

    // Handle enter key to finish editing
    heading.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        heading.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        heading.textContent = content; // Reset to original
        heading.blur();
      }
    });

    return heading;
  }
}