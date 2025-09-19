// src/visual-codemirror/widgets/command-widget.ts
import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { NestedContentRenderer } from '../nested-content-renderer';

export class CommandWidget extends BaseLatexWidget {
  private isEditing: boolean = false;
  private editableSpan?: HTMLSpanElement;

  private _parseAndSetTokenProperties(latex: string): void {
    const colorMatch = latex.match(/^\\(textcolor|colorbox)\{([^}]*)\}\{(.*)\}$/s);
    const regularMatch = latex.match(/^\\([a-zA-Z*]+)\{(.*)\}$/s);

    if (colorMatch) {
      this.token.name = colorMatch[1];
      this.token.colorArg = colorMatch[2];
      this.token.content = colorMatch[3];
    } else if (regularMatch) {
      this.token.name = regularMatch[1];
      this.token.content = regularMatch[2];
      this.token.colorArg = undefined;
    } else {
      this.token.name = this.token.name || 'unknown';
      this.token.content = this.token.content || latex;
      this.token.colorArg = undefined;
    }

    this.token.latex = latex;
  }

  // Override the base class method to be more surgical
  protected updateTokenInEditor(view: EditorView, newLatex: string) {
    // Find the exact position of THIS command token within the document
    const pos = this.findExactCommandPosition(view);
    if (pos === null) return;

    const { from, to } = pos;

    // Update token properties first
    this.token.latex = newLatex;
    if (newLatex.includes('{') && newLatex.includes('}')) {
      const contentMatch = newLatex.match(/\{([^}]*)\}$/);
      if (contentMatch) {
        this.token.content = contentMatch[1];
      }
    }

    // Only update the specific command, not the entire document
    setTimeout(() => {
      view.dispatch({
        changes: { from, to, insert: newLatex }
      });
    }, 0);
  }

  private findExactCommandPosition(view: EditorView): { from: number; to: number } | null {
    const doc = view.state.doc.toString();
    const tokenLatex = this.token.latex;
    
    if (!tokenLatex) return null;

    // If we have stored position information, try that first
    if (typeof this.token.start === 'number' && typeof this.token.end === 'number') {
      if (this.token.start < doc.length && this.token.end <= doc.length) {
        const actualContent = doc.slice(this.token.start, this.token.end);
        if (actualContent === tokenLatex) {
          return { from: this.token.start, to: this.token.end };
        }
      }
    }

    // Look for exact matches of our command
    let searchStart = 0;
    while (true) {
      const index = doc.indexOf(tokenLatex, searchStart);
      if (index === -1) break;

      // Check if this is a standalone command (not part of a larger string)
      const before = index > 0 ? doc[index - 1] : ' ';
      const after = index + tokenLatex.length < doc.length ? doc[index + tokenLatex.length] : ' ';
      
      // Commands should be preceded by whitespace, newline, or start of document
      // and followed by whitespace, newline, or end of document
      if ((before.match(/\s/) || index === 0) && 
          (after.match(/\s/) || index + tokenLatex.length === doc.length)) {
        return { from: index, to: index + tokenLatex.length };
      }
      
      searchStart = index + 1;
    }

    return null;
  }

  toDOM(view: EditorView): HTMLElement {
    this._parseAndSetTokenProperties(this.token.latex);

    const { name = '', content = '', colorArg = '' } = this.token;

    if (this.showCommands) {
      return this.createCommandView(view, name, content, colorArg);
    }

    return this.createStyledCommandView(view, name, content, colorArg);
  }

  private createCommandView(view: EditorView, cmdName: string, content: string, colorArg: string): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'latex-command-raw latex-visual-widget';
    wrapper.style.display = 'inline-block';
    wrapper.style.margin = '0 2px';
    wrapper.style.padding = '2px 6px';
    wrapper.style.background = 'rgba(220, 53, 69, 0.1)';
    wrapper.style.border = '1px solid rgba(220, 53, 69, 0.3)';
    wrapper.style.borderRadius = '3px';
    wrapper.style.fontFamily = 'monospace';
    wrapper.style.fontSize = '0.9em';
    wrapper.style.color = '#dc3545';

    const editableSpan = document.createElement('span');
    editableSpan.contentEditable = 'true';
    editableSpan.textContent = this.token.latex;
    editableSpan.style.outline = 'none';
    editableSpan.style.background = 'transparent';
    editableSpan.style.minWidth = '3em';
    editableSpan.style.display = 'inline-block';

    // Store original latex for fallback
    wrapper.dataset.originalLatex = this.token.latex;

    editableSpan.addEventListener('blur', () => {
      const newLatex = editableSpan.textContent || '';
      if (newLatex !== this.token.latex) {
        this.updateTokenInEditor(view, newLatex);
      }
    });

    editableSpan.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        editableSpan.blur();
        e.preventDefault();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        editableSpan.blur();
        e.preventDefault();
      }
    });

    editableSpan.addEventListener('input', (e) => {
      e.stopPropagation();
    });

    editableSpan.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    editableSpan.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    editableSpan.addEventListener('focus', (e) => {
      e.stopPropagation();
    });

    wrapper.appendChild(editableSpan);

    return wrapper;
  }

  private createStyledCommandView(view: EditorView, cmdName: string, content: string, colorArg: string): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'latex-command-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline';
    wrapper.style.cursor = 'text';
    wrapper.tabIndex = 0;
    wrapper.style.outline = 'none';

    // Store original latex for preservation
    wrapper.dataset.originalLatex = this.token.latex;

    const visualSpan = document.createElement('span');
    visualSpan.className = `latex-visual-command ${cmdName}`;

    this.updateVisualContent(visualSpan, content);
    this.applyCommandStyles(visualSpan, cmdName, colorArg);
    wrapper.appendChild(visualSpan);

    this.setupInlineEditing(wrapper, visualSpan, view);

    wrapper.addEventListener('focus', () => {
      wrapper.style.background = 'rgba(0, 123, 255, 0.05)';
      wrapper.style.borderRadius = '2px';
    });

    wrapper.addEventListener('blur', () => {
      wrapper.style.background = '';
    });

    return wrapper;
  }

  private updateVisualContent(visualSpan: HTMLElement, content: string): void {
    visualSpan.innerHTML = '';

    if (!content || content.length > 200) {
      visualSpan.textContent = content || '';
      return;
    }

    try {
      if (content.includes('\\') && content.length < 100) {
        NestedContentRenderer.renderNestedContent(visualSpan, content, null as any, this.showCommands);
      } else {
        visualSpan.textContent = content;
      }
    } catch (error) {
      console.warn('Error rendering command content, using plain text:', error);
      visualSpan.textContent = content;
    }
  }

  private setupEditingEvents(view: EditorView, wrapper: HTMLElement, visualSpan: HTMLElement) {
    if (!this.editableSpan) return;

    const finishEditing = () => {
      if (!this.isEditing || !this.editableSpan) return;
      this.isEditing = false;

      const newLatex = (this.editableSpan.textContent || '').trim();

      if (newLatex && newLatex !== this.token.latex) {
        this.updateTokenInEditor(view, newLatex);
        this._parseAndSetTokenProperties(newLatex);
        this.updateVisualContent(visualSpan, this.token.content || '');
        this.reapplyCommandStyles(visualSpan);
      }

      visualSpan.style.display = '';
      if (this.editableSpan.parentNode) {
        this.editableSpan.parentNode.removeChild(this.editableSpan);
      }
      this.editableSpan = undefined;

      wrapper.blur();
    };

    const cancelEditing = () => {
      if (!this.isEditing || !this.editableSpan) return;
      this.isEditing = false;

      visualSpan.style.display = '';
      if (this.editableSpan.parentNode) {
        this.editableSpan.parentNode.removeChild(this.editableSpan);
      }
      this.editableSpan = undefined;
      wrapper.blur();
    };

    let blurTimeout: number;

    this.editableSpan.addEventListener('blur', (e) => {
      blurTimeout = window.setTimeout(() => {
        if (this.isEditing && document.activeElement !== this.editableSpan) {
          finishEditing();
        }
      }, 150);
    });

    this.editableSpan.addEventListener('focus', () => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
      }
    });

    this.editableSpan.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        finishEditing();
        setTimeout(() => {
          const nextFocusable = this.findNextFocusableElement(wrapper);
          if (nextFocusable) nextFocusable.focus();
        }, 0);
      }
    });

    this.editableSpan.addEventListener('mousedown', (e) => e.stopPropagation());
    this.editableSpan.addEventListener('click', (e) => e.stopPropagation());

    const handleGlobalClick = (e: Event) => {
      if (this.isEditing && this.editableSpan && !this.editableSpan.contains(e.target as Node)) {
        finishEditing();
        document.removeEventListener('click', handleGlobalClick, true);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleGlobalClick, true);
    }, 100);
  }

  private setupInlineEditing(wrapper: HTMLElement, visualSpan: HTMLElement, view: EditorView) {
    const startEditing = (clickX?: number) => {
      if (this.isEditing) return;
      this.isEditing = true;

      visualSpan.style.display = 'none';

      this.editableSpan = document.createElement('span');
      this.editableSpan.contentEditable = 'true';
      this.editableSpan.style.outline = '2px solid #007acc';
      this.editableSpan.style.outlineOffset = '1px';
      this.editableSpan.style.background = 'rgba(255, 255, 255, 0.95)';
      this.editableSpan.style.padding = '2px 4px';
      this.editableSpan.style.margin = '-2px -4px';
      this.editableSpan.style.borderRadius = '3px';
      this.editableSpan.style.fontFamily = 'monospace';
      this.editableSpan.style.fontSize = '0.9em';
      this.editableSpan.style.color = '#dc3545';
      this.editableSpan.style.minWidth = '3em';
      this.editableSpan.style.whiteSpace = 'nowrap';
      this.editableSpan.style.zIndex = '1000';
      this.editableSpan.style.position = 'relative';
      this.editableSpan.textContent = this.token.latex;

      wrapper.appendChild(this.editableSpan);

      setTimeout(() => {
        if (this.editableSpan) {
          this.editableSpan.focus();
          if (clickX !== undefined) {
            this.positionCursorFromClick(this.editableSpan, clickX);
          } else {
            this.selectEditableContent(this.editableSpan);
          }
        }
      }, 10);

      this.setupEditingEvents(view, wrapper, visualSpan);
    };

    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isEditing) {
        startEditing(e.clientX);
      }
    });

    wrapper.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isEditing) {
        startEditing();
      }
    });

    wrapper.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === 'F2') && !this.isEditing) {
        e.preventDefault();
        e.stopPropagation();
        startEditing();
      }
    });
  }

  private positionCursorFromClick(editableSpan: HTMLElement, clickX: number) {
    try {
      const rect = editableSpan.getBoundingClientRect();
      const text = editableSpan.textContent || '';
      const relativeX = clickX - rect.left - 4;
      const charWidth = (rect.width - 8) / Math.max(text.length, 1);
      const charIndex = Math.max(0, Math.min(Math.round(relativeX / charWidth), text.length));

      if (editableSpan.firstChild) {
        const range = document.createRange();
        range.setStart(editableSpan.firstChild, charIndex);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    } catch (e) {
      this.selectEditableContent(editableSpan);
    }
  }

  private selectEditableContent(editableSpan: HTMLElement) {
    const selection = window.getSelection();
    const range = document.createRange();
    const text = editableSpan.textContent || '';
    const lastBraceIndex = text.lastIndexOf('{');
    const closingBraceIndex = text.lastIndexOf('}');

    if (lastBraceIndex !== -1 && closingBraceIndex > lastBraceIndex && editableSpan.firstChild) {
      range.setStart(editableSpan.firstChild, lastBraceIndex + 1);
      range.setEnd(editableSpan.firstChild, closingBraceIndex);
    } else if (editableSpan.firstChild) {
      range.selectNodeContents(editableSpan);
    }

    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  private findNextFocusableElement(currentElement: HTMLElement): HTMLElement | null {
    const focusableElements = Array.from(document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .latex-command-wrapper'
    )) as HTMLElement[];
    const currentIndex = focusableElements.indexOf(currentElement);
    return currentIndex > -1 && currentIndex < focusableElements.length - 1
      ? focusableElements[currentIndex + 1]
      : null;
  }

  private applyCommandStyles(element: HTMLElement, cmdName: string, colorArg: string) {
    switch (cmdName) {
      case 'textbf': element.style.fontWeight = 'bold'; break;
      case 'textit': case 'emph': element.style.fontStyle = 'italic'; break;
      case 'underline': element.style.textDecoration = 'underline'; break;
      case 'textsc': element.style.fontVariant = 'small-caps'; break;
      case 'textsf': element.style.fontFamily = 'sans-serif'; break;
      case 'texttt':
        element.style.fontFamily = 'monospace';
        element.style.background = 'rgba(0, 0, 0, 0.05)';
        element.style.borderRadius = '2px';
        element.style.padding = '1px 2px';
        break;
      case 'textcolor': case 'color': if (colorArg) element.style.color = colorArg; break;
      case 'colorbox':
        if (colorArg) {
          element.style.backgroundColor = colorArg;
          element.style.padding = '2px 4px';
          element.style.borderRadius = '2px';
        }
        break;
    }
  }

  private reapplyCommandStyles(visualSpan: HTMLElement) {
    const { name = '', colorArg = '' } = this.token;
    visualSpan.style.cssText = '';
    visualSpan.className = `latex-visual-command ${name}`;
    this.applyCommandStyles(visualSpan, name, colorArg);
  }
}