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
    if (this.showCommands) {
      return this.createCommandView(view);
    }

    const container = document.createElement('div');
    container.className = `${this.isDisplay ? 'latex-visual-math-display' : 'latex-visual-math-inline'} latex-visual-widget`;
    container.style.lineHeight = '1.0';
    container.style.position = 'relative';

    if (this.isDisplay) {
      container.style.margin = '0';
      this.preserveLineHeight(container, this.token.latex);
    }

    this.mathfield = createEditableMath(this.token.content, this.isDisplay);
    (this.mathfield as any).readOnly = true;

    const editButton = this.createEditButton();

    container.appendChild(this.mathfield);
    container.appendChild(editButton);

    this.setupEventHandlers(container, editButton, view);

    return container;
  }

  private createEditButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'math-edit-button';
    button.innerHTML = '✏️';
    button.style.position = 'absolute';
    button.style.top = this.isDisplay ? '6px' : '-6px';
    button.style.right = this.isDisplay ? '6px' : '-6px';
    button.style.width = this.isDisplay ? '18px' : '14px';
    button.style.height = this.isDisplay ? '18px' : '14px';
    button.style.background = '#007acc';
    button.style.color = 'white';
    button.style.fontSize = this.isDisplay ? '10px' : '8px';
    button.style.border = 'none';
    button.style.borderRadius = '50%';
    button.style.cursor = 'pointer';
    button.style.opacity = '0';
    button.style.transition = 'opacity 0.2s';
    button.style.zIndex = '100';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.title = 'Open math editor';
    return button;
  }

  private setupEventHandlers(container: HTMLElement, editButton: HTMLElement, view: EditorView): void {
    container.addEventListener('mouseenter', () => {
      editButton.style.opacity = '1';
    });

    container.addEventListener('mouseleave', () => {
      editButton.style.opacity = '0';
    });

    editButton.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.openFloatingEditor(view, container);
    });

    this.mathfield.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      this.showInlineEditor(view, container);
    });
  }

  private createCommandView(view: EditorView): HTMLElement {
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

    const mathInput = document.createElement('span');
    mathInput.contentEditable = 'true';
    mathInput.textContent = this.token.content;
    mathInput.style.margin = '0 4px';
    mathInput.style.outline = 'none';
    mathInput.style.fontFamily = 'monospace';

    const suffix = document.createElement('span');
    suffix.textContent = delimiter;
    suffix.style.color = '#6f42c1';
    suffix.style.fontWeight = '600';

    mathInput.addEventListener('blur', () => {
      const newContent = mathInput.textContent || '';
      if (newContent !== this.token.content) {
        this.updateContent(view, newContent);
      }
    });

    mathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        mathInput.blur();
        e.preventDefault();
      } else if (e.key === 'Enter') {
        mathInput.blur();
        e.preventDefault();
      }
    });

    wrapper.appendChild(prefix);
    wrapper.appendChild(mathInput);
    wrapper.appendChild(suffix);

    return wrapper;
  }

  private showInlineEditor(view: EditorView, container: HTMLElement): void {
    if (container.dataset.inlineEditing === 'true') return;

    container.dataset.inlineEditing = 'true';

    const mathfield = container.querySelector('.mathfield') as HTMLElement;
    if (mathfield) {
      mathfield.style.display = 'none';
    }

    const delimiter = this.isDisplay ? '$$' : '$';

    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'math-inline-editor';
    editorWrapper.style.fontFamily = 'monospace';
    editorWrapper.style.background = 'rgba(111, 66, 193, 0.1)';
    editorWrapper.style.border = '1px solid rgba(111, 66, 193, 0.3)';
    editorWrapper.style.borderRadius = '4px';
    editorWrapper.style.padding = '6px';
    editorWrapper.style.display = this.isDisplay ? 'block' : 'inline-block';
    editorWrapper.style.minWidth = '60px';

    const prefixSpan = document.createElement('span');
    prefixSpan.textContent = delimiter;
    prefixSpan.style.color = '#6f42c1';
    prefixSpan.style.fontWeight = 'bold';

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.value = this.token.content;
    inputField.style.border = 'none';
    inputField.style.background = 'transparent';
    inputField.style.outline = 'none';
    inputField.style.fontFamily = 'monospace';
    inputField.style.margin = '0 4px';
    inputField.style.minWidth = '30px';
    inputField.style.width = `${Math.max(this.token.content.length * 8, 60)}px`;
    inputField.style.color = '#000';
    inputField.style.fontSize = '14px';

    const suffixSpan = document.createElement('span');
    suffixSpan.textContent = delimiter;
    suffixSpan.style.color = '#6f42c1';
    suffixSpan.style.fontWeight = 'bold';

    editorWrapper.appendChild(prefixSpan);
    editorWrapper.appendChild(inputField);
    editorWrapper.appendChild(suffixSpan);
    container.appendChild(editorWrapper);

    inputField.focus();
    inputField.select();

    let isActive = true;

    const finishEditing = (shouldSave: boolean) => {
      if (!isActive) return;
      isActive = false;

      container.dataset.inlineEditing = 'false';

      if (shouldSave) {
        const newContent = inputField.value.trim();
        if (newContent && newContent !== this.token.content) {
          this.updateContent(view, newContent);
        }
      }

      if (editorWrapper.parentNode) {
        editorWrapper.parentNode.removeChild(editorWrapper);
      }

      if (mathfield) {
        mathfield.style.display = '';
      }

      document.removeEventListener('click', handleOutsideClick, true);
    };

    const handleOutsideClick = (e: Event) => {
      if (isActive && !editorWrapper.contains(e.target as Node)) {
        finishEditing(true);
      }
    };

    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEditing(true);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Escape') {
        finishEditing(false);
        e.preventDefault();
        e.stopPropagation();
      }
    });

    inputField.addEventListener('input', () => {
      inputField.style.width = `${Math.max(inputField.value.length * 8, 60)}px`;
    });

    editorWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick, true);
    }, 200);
  }

  private openFloatingEditor(view: EditorView, container: HTMLElement): void {
    if (container.dataset.floatingEditing === 'true') return;

    container.dataset.floatingEditing = 'true';

    const rect = container.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'math-floating-editor';
    overlay.style.position = 'fixed';
    overlay.style.left = `${rect.left - 10}px`;
    overlay.style.top = `${rect.top - 10}px`;
    overlay.style.minWidth = `${Math.max(rect.width + 20, 300)}px`;
    overlay.style.minHeight = '100px';
    overlay.style.background = 'white';
    overlay.style.border = '2px solid #007acc';
    overlay.style.borderRadius = '8px';
    overlay.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
    overlay.style.padding = '15px';
    overlay.style.zIndex = '10000';

    const mathEditor = createEditableMath(this.token.content, this.isDisplay);
    (mathEditor as any).readOnly = false;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '8px';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.background = '#6c757d';
    cancelButton.style.color = 'white';
    cancelButton.style.cursor = 'pointer';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.padding = '8px 16px';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.style.background = '#007acc';
    saveButton.style.color = 'white';
    saveButton.style.cursor = 'pointer';

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    overlay.appendChild(mathEditor);
    overlay.appendChild(buttonContainer);
    document.body.appendChild(overlay);

    setTimeout(() => (mathEditor as any).focus(), 50);

    const closeEditor = (shouldSave: boolean) => {
      container.dataset.floatingEditing = 'false';

      if (shouldSave) {
        const newLatex = (mathEditor as any).getValue('latex');
        if (newLatex && newLatex !== this.token.content) {
          this.updateContent(view, newLatex);
        }
      }

      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    saveButton.addEventListener('click', () => closeEditor(true));
    cancelButton.addEventListener('click', () => closeEditor(false));

    const handleOutsideClick = (e: Event) => {
      if (!overlay.contains(e.target as Node)) {
        closeEditor(true);
        document.removeEventListener('click', handleOutsideClick, true);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick, true);
    }, 100);
  }

  private updateContent(view: EditorView, newLatex: string): void {
    const delimiter = this.isDisplay ? '$$' : '$';
    const fullLatex = `${delimiter}${newLatex}${delimiter}`;

    const pos = this.findTokenInDocument(view);
    if (pos === null) {
      console.warn('Could not find token position');
      return;
    }

    view.dispatch({
      changes: { from: pos.from, to: pos.to, insert: fullLatex }
    });

    this.token.content = newLatex;
    this.token.latex = fullLatex;

    if (this.mathfield) {
      try {
        (this.mathfield as any).setValue(newLatex, { suppressChangeNotifications: true });
      } catch (error) {
        console.warn('Error updating mathfield:', error);
      }
    }
  }
}