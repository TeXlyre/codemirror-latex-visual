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

      this.setupEditableElement(contentSpan, view, (newContent) => {
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

    this.setupEditableElement(heading, view, (newContent) => {
      if (newContent !== content) {
        const newLatex = `\\${sectionName}{${newContent}}`;
        this.updateTokenInEditor(view, newLatex);
      }
    });

    return heading;
  }

  private setupEditableElement(element: HTMLElement, view: EditorView, onUpdate: (newContent: string) => void) {
    const originalContent = element.textContent || '';

    // Make element appear editable but not actually contentEditable yet
    element.style.cursor = 'text';
    element.style.userSelect = 'text';
    element.style.position = 'relative';

    // Add visual indicator that this is editable
    element.title = 'Click to edit';

    let isEditing = false;
    let editableSpan: HTMLSpanElement | null = null;

    const startEditing = (clickX?: number) => {
      if (isEditing) return;
      isEditing = true;

      // Store original styles instead of making transparent
      const originalColor = element.style.color || getComputedStyle(element).color;

      // Create an input-like span overlay
      editableSpan = document.createElement('span');
      editableSpan.contentEditable = 'true';
      editableSpan.textContent = element.textContent;
      editableSpan.style.position = 'absolute';
      editableSpan.style.top = '0';
      editableSpan.style.left = '0';
      editableSpan.style.width = '100%';
      editableSpan.style.minHeight = '100%';
      editableSpan.style.background = 'rgba(255, 255, 255, 0.95)';
      editableSpan.style.color = originalColor || '#333'; // Ensure visible color
      editableSpan.style.outline = '2px solid #007acc';
      editableSpan.style.outlineOffset = '1px';
      editableSpan.style.padding = '2px 4px';
      editableSpan.style.margin = '-2px -4px';
      editableSpan.style.borderRadius = '2px';
      editableSpan.style.fontSize = 'inherit';
      editableSpan.style.fontWeight = 'inherit';
      editableSpan.style.fontFamily = 'inherit';
      editableSpan.style.lineHeight = 'inherit';
      editableSpan.style.zIndex = '1000';
      editableSpan.style.boxSizing = 'border-box';

      // Hide original text by making it transparent, but keep layout
      element.style.color = 'transparent';

      element.appendChild(editableSpan);

      // Focus and select
      setTimeout(() => {
        editableSpan!.focus();

        if (clickX !== undefined) {
          // Try to position cursor based on click
          const selection = window.getSelection();
          const range = document.createRange();

          try {
            if (editableSpan!.firstChild) {
              const textNode = editableSpan!.firstChild;
              const text = textNode.textContent || '';
              const rect = editableSpan!.getBoundingClientRect();
              const relativeX = clickX - rect.left - 4; // Account for padding
              const charWidth = (rect.width - 8) / text.length; // Account for padding
              const charIndex = Math.max(0, Math.min(Math.round(relativeX / charWidth), text.length));

              range.setStart(textNode, charIndex);
              range.setEnd(textNode, charIndex);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          } catch (e) {
            // Fallback to select all
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editableSpan!);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        } else {
          // Select all text
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editableSpan!);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 10);

      const finishEditing = () => {
        if (!isEditing || !editableSpan) return;
        isEditing = false;

        const newContent = editableSpan.textContent || '';
        element.textContent = newContent;
        element.style.color = originalColor; // Restore original color

        if (editableSpan.parentNode) {
          editableSpan.parentNode.removeChild(editableSpan);
        }
        editableSpan = null;

        if (newContent !== originalContent) {
          onUpdate(newContent);
        }
      };

      // Handle events on the editable span
      editableSpan.addEventListener('blur', finishEditing);

      editableSpan.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finishEditing();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          if (editableSpan) {
            editableSpan.textContent = originalContent;
          }
          finishEditing();
        }
      });

      // Prevent clicks from bubbling up
      editableSpan.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      editableSpan.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    };

    // Handle clicks on the main element
    element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isEditing) {
        startEditing(e.clientX);
      }
    });

    element.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Double-click to select all
    element.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isEditing) {
        startEditing();
      }
    });
  }
}