import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { createEditableMath } from '../../math-field-utils';

export class MathWidget extends BaseLatexWidget {
  private isDisplay: boolean;
  private mathfield?: any;

  constructor(token: any, isDisplay: boolean, showCommands: boolean = false) {
    super(token, showCommands);
    this.isDisplay = isDisplay;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = `${this.isDisplay ? 'latex-visual-math-display' : 'latex-visual-math-inline'} latex-visual-widget`;
    container.style.lineHeight = '1.0';

    if (this.isDisplay) {
      container.style.margin = '0';
      this.preserveLineHeight(container, this.token.latex);
    }

    if (this.showCommands) {
      const wrapper = document.createElement('div');
      wrapper.className = 'latex-math-command-wrapper';
      wrapper.style.fontFamily = 'monospace';
      wrapper.style.background = 'rgba(111, 66, 193, 0.1)';
      wrapper.style.border = '1px solid rgba(111, 66, 193, 0.3)';
      wrapper.style.borderRadius = '4px';
      wrapper.style.padding = '8px';
      wrapper.style.margin = '0';
      wrapper.style.display = this.isDisplay ? 'block' : 'inline-block';
      wrapper.style.lineHeight = '1.4';

      if (this.isDisplay) {
        this.preserveLineHeight(wrapper, this.token.latex);
      }

      const delimiter = this.isDisplay ? '$$' : '$';
      const prefix = document.createElement('span');
      prefix.textContent = delimiter;
      prefix.style.color = '#6f42c1';
      prefix.style.fontWeight = '600';

      const mathSpan = document.createElement('span');
      mathSpan.contentEditable = 'true';
      mathSpan.textContent = this.token.content;
      mathSpan.style.margin = '0 4px';
      mathSpan.style.outline = 'none';
      mathSpan.style.fontFamily = 'monospace';

      const suffix = document.createElement('span');
      suffix.textContent = delimiter;
      suffix.style.color = '#6f42c1';
      suffix.style.fontWeight = '600';

      mathSpan.addEventListener('blur', () => {
        const newContent = mathSpan.textContent || '';
        if (newContent !== this.token.content) {
          const newLatex = `${delimiter}${newContent}${delimiter}`;
          this.updateTokenInEditor(view, newLatex);
        }
      });

      mathSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          mathSpan.blur();
          e.preventDefault();
        }
      });

      wrapper.appendChild(prefix);
      wrapper.appendChild(mathSpan);
      wrapper.appendChild(suffix);

      return wrapper;
    }

    this.mathfield = createEditableMath(this.token.content, this.isDisplay);
    (this.mathfield as any).readOnly = true;

    const indicator = document.createElement('div');
    indicator.className = 'math-edit-indicator';
    indicator.innerHTML = '✏️';
    indicator.style.position = 'absolute';
    indicator.style.top = this.isDisplay ? '6px' : '-6px';
    indicator.style.right = this.isDisplay ? '6px' : '-6px';
    indicator.style.width = this.isDisplay ? '18px' : '14px';
    indicator.style.height = this.isDisplay ? '18px' : '14px';
    indicator.style.background = '#007acc';
    indicator.style.color = 'white';
    indicator.style.fontSize = this.isDisplay ? '10px' : '8px';
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.justifyContent = 'center';
    indicator.style.borderRadius = '50%';
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 0.2s';
    indicator.style.zIndex = '10';

    container.style.position = 'relative';
    container.style.cursor = 'pointer';

    container.addEventListener('mouseenter', () => {
      indicator.style.opacity = '1';
    });

    container.addEventListener('mouseleave', () => {
      indicator.style.opacity = '0';
    });

    container.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startMathEditing(view, container);
    });

    container.appendChild(this.mathfield);
    container.appendChild(indicator);

    return container;
  }

  private startMathEditing(view: EditorView, container: HTMLElement) {
    if (container.dataset.editing === 'true') return;
    container.dataset.editing = 'true';

    const rect = container.getBoundingClientRect();
    const currentValue = this.mathfield?.getValue('latex') || this.token.content;

    const floatingContainer = document.createElement('div');
    floatingContainer.className = 'mathfield-editor-overlay';
    floatingContainer.style.position = 'fixed';
    floatingContainer.style.left = `${rect.left - 10}px`;
    floatingContainer.style.top = `${rect.top - 10}px`;
    floatingContainer.style.minWidth = `${Math.max(rect.width + 20, 250)}px`;
    floatingContainer.style.minHeight = '80px';
    floatingContainer.style.zIndex = '10000';
    floatingContainer.style.background = 'white';
    floatingContainer.style.border = '2px solid #007acc';
    floatingContainer.style.borderRadius = '6px';
    floatingContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
    floatingContainer.style.padding = '10px';

    const newMathfield = createEditableMath(currentValue, this.isDisplay);
    (newMathfield as any).readOnly = false;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '8px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '6px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.padding = '6px 12px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.background = '#6c757d';
    cancelBtn.style.color = 'white';

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done';
    doneBtn.style.border = 'none';
    doneBtn.style.borderRadius = '4px';
    doneBtn.style.padding = '6px 12px';
    doneBtn.style.cursor = 'pointer';
    doneBtn.style.background = '#007acc';
    doneBtn.style.color = 'white';

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(doneBtn);
    floatingContainer.appendChild(newMathfield);
    floatingContainer.appendChild(buttonContainer);
    document.body.appendChild(floatingContainer);

    setTimeout(() => (newMathfield as any).focus(), 10);

    let isFinishing = false;
    const finishEditing = (save: boolean) => {
      if (isFinishing) return;
      isFinishing = true;

      container.dataset.editing = 'false';

      if (save) {
        const newLatex = (newMathfield as any).getValue('latex');
        if (newLatex !== this.token.content) {
          this.updateMathInEditor(view, newLatex);
        }
      }

      try {
        if (floatingContainer && floatingContainer.parentNode) {
          floatingContainer.parentNode.removeChild(floatingContainer);
        }
      } catch (error) {
        console.warn('Error removing math editor overlay:', error);
      }

      document.removeEventListener('mousedown', handleClickOutside, true);
    };

    const handleClickOutside = (e: Event) => {
      if (!isFinishing && floatingContainer && !floatingContainer.contains(e.target as Node)) {
        finishEditing(true);
      }
    };

    doneBtn.addEventListener('click', () => finishEditing(true));
    cancelBtn.addEventListener('click', () => finishEditing(false));

    (newMathfield as any).addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishEditing(false);
        e.preventDefault();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        finishEditing(true);
        e.preventDefault();
      }
    });

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 100);
  }

  private updateMathInEditor(view: EditorView, newLatex: string) {
    const delimiter = this.isDisplay ? '$$' : '$';
    const newFullLatex = `${delimiter}${newLatex}${delimiter}`;
    const pos = this.findTokenInDocument(view);
    if (pos === null) {
      console.warn('Could not find token to update in document.');
      return;
    }

    view.dispatch({
      changes: { from: pos.from, to: pos.to, insert: newFullLatex }
    });

    this.token.content = newLatex;
    this.token.latex = newFullLatex;

    if (this.mathfield) {
      (this.mathfield as any).setValue(newLatex, { suppressChangeNotifications: true });
    }
  }
}