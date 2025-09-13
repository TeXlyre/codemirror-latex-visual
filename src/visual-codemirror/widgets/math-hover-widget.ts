// src/visual-codemirror/widgets/math-hover-widget.ts
import { EditorView } from '@codemirror/view';
import { StateField, StateEffect, Extension } from '@codemirror/state';
import { createEditableMath } from '../../math-field-utils';
import { LatexTokenizer } from '../../parsers/main-parser';
import { errorService, ErrorCategory, ErrorSeverity } from '../../core/error-service';

interface MathHoverInfo {
  from: number;
  to: number;
  content: string;
  isDisplay: boolean;
  latex: string;
}

const setMathHoverEffect = StateEffect.define<boolean>();

const mathHoverEnabledField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(setMathHoverEffect)) {
        return effect.value;
      }
    }
    return value;
  }
});

export class MathHoverManager {
  private view: EditorView;
  private tokenizer: LatexTokenizer;
  private isEnabled: boolean = false;
  private currentWidget: HTMLElement | null = null;
  private isEditing: boolean = false;
  private hoverTimer: number | null = null;
  private clearTimer: number | null = null;

  constructor(view: EditorView) {
    this.view = view;
    this.tokenizer = new LatexTokenizer();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.view.dom.addEventListener('mousemove', this.handleEditorMouseMove.bind(this));
    this.view.dom.addEventListener('mouseleave', this.handleEditorMouseLeave.bind(this));
    this.view.dom.addEventListener('click', this.handleEditorClick.bind(this));
  }

  private handleEditorMouseMove(e: MouseEvent): void {
    if (!this.isEnabled || this.isEditing) return;

    this.clearTimer && clearTimeout(this.clearTimer);
    this.hoverTimer && clearTimeout(this.hoverTimer);

    this.hoverTimer = window.setTimeout(() => {
      const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos !== null) {
        const mathInfo = this.findMathAtPosition(pos);
        if (mathInfo) {
          this.showMathWidget(mathInfo, e);
        } else {
          this.hideWidget();
        }
      }
    }, 300);
  }

  private handleEditorMouseLeave(): void {
    if (!this.isEditing) {
      this.scheduleHide();
    }
  }

  private handleEditorClick(e: MouseEvent): void {
    if (this.currentWidget && !this.currentWidget.contains(e.target as Node)) {
      this.hideWidget();
    }
  }

  private findMathAtPosition(pos: number): MathHoverInfo | null {
    const text = this.view.state.doc.toString();
    
    try {
      const tokens = this.tokenizer.tokenize(text);
      
      for (const token of tokens) {
        if ((token.type === 'math_inline' || token.type === 'math_display') && token.content) {
          const from = text.indexOf(token.latex);
          if (from !== -1 && pos >= from && pos <= from + token.latex.length) {
            return {
              from,
              to: from + token.latex.length,
              content: token.content,
              isDisplay: token.type === 'math_display',
              latex: token.latex
            };
          }
        }
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Failed to find math at position',
        { pos, error }
      );
    }

    return null;
  }

  private showMathWidget(mathInfo: MathHoverInfo, mouseEvent: MouseEvent): void {
    if (this.currentWidget?.dataset.mathLatex === mathInfo.latex) {
      return;
    }

    this.hideWidget();
    
    try {
      const widget = this.createWidget(mathInfo, mouseEvent);
      document.body.appendChild(widget);
      this.currentWidget = widget;
      
      this.setupWidgetEvents(widget, mathInfo);
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.ERROR,
        'Failed to show math widget',
        { mathInfo, error }
      );
    }
  }

  private createWidget(mathInfo: MathHoverInfo, mouseEvent: MouseEvent): HTMLElement {
    const widget = document.createElement('div');
    widget.className = 'math-hover-preview';
    widget.dataset.mathLatex = mathInfo.latex;
    
    Object.assign(widget.style, {
      position: 'fixed',
      zIndex: '10000',
      background: 'white',
      border: '2px solid #007acc',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      maxWidth: '400px',
      minWidth: mathInfo.isDisplay ? '200px' : '100px',
      left: `${Math.min(mouseEvent.clientX + 10, window.innerWidth - 420)}px`,
      top: `${Math.max(mouseEvent.clientY - 10, 10)}px`
    });

    const container = document.createElement('div');
    container.className = `math-preview-container ${mathInfo.isDisplay ? 'display' : 'inline'}`;
    Object.assign(container.style, {
      position: 'relative',
      display: mathInfo.isDisplay ? 'block' : 'inline-block',
      margin: mathInfo.isDisplay ? '10px 0' : '0 2px',
      minHeight: mathInfo.isDisplay ? '40px' : '20px'
    });

    const mathfield = createEditableMath(mathInfo.content, mathInfo.isDisplay);
    (mathfield as any).readOnly = true;

    const editButton = this.createEditButton(mathInfo.isDisplay);
    
    container.appendChild(mathfield);
    container.appendChild(editButton);
    widget.appendChild(container);

    return widget;
  }

  private createEditButton(isDisplay: boolean): HTMLElement {
    const button = document.createElement('button');
    button.className = 'math-edit-button';
    button.innerHTML = '✏️';
    button.title = 'Edit math expression';
    
    Object.assign(button.style, {
      position: 'absolute',
      top: isDisplay ? '6px' : '-8px',
      right: isDisplay ? '6px' : '-8px',
      width: isDisplay ? '24px' : '20px',
      height: isDisplay ? '24px' : '20px',
      background: '#007acc',
      color: 'white',
      fontSize: isDisplay ? '12px' : '10px',
      border: 'none',
      borderRadius: '50%',
      cursor: 'pointer',
      opacity: '0',
      transition: 'all 0.2s ease',
      zIndex: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
    });

    return button;
  }

  private setupWidgetEvents(widget: HTMLElement, mathInfo: MathHoverInfo): void {
    const editButton = widget.querySelector('.math-edit-button') as HTMLElement;
    const mathfield = widget.querySelector('math-field') as any;

    // Show/hide edit button
    widget.addEventListener('mouseenter', () => {
      editButton.style.opacity = '1';
      this.clearTimer && clearTimeout(this.clearTimer);
    });

    widget.addEventListener('mouseleave', () => {
      if (!this.isEditing) {
        editButton.style.opacity = '0';
        this.scheduleHide();
      }
    });

    // Edit button click
    editButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startEditing(widget, mathfield, mathInfo);
    });

    // Prevent widget closing on internal clicks
    widget.addEventListener('click', (e) => e.stopPropagation());

    // Close on outside click
    const handleOutsideClick = (e: Event) => {
      if (!widget.contains(e.target as Node) && !this.isEditing) {
        this.hideWidget();
        document.removeEventListener('click', handleOutsideClick, true);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick, true);
    }, 100);
  }

  private startEditing(widget: HTMLElement, mathfield: any, mathInfo: MathHoverInfo): void {
    this.isEditing = true;
    
    const editButton = widget.querySelector('.math-edit-button') as HTMLElement;
    editButton.style.opacity = '0';
    editButton.style.pointerEvents = 'none';

    (mathfield as any).readOnly = false;

    const buttonContainer = this.createEditorButtons();
    widget.appendChild(buttonContainer);

    setTimeout(() => (mathfield as any).focus(), 50);

    const finishEditing = (shouldSave: boolean) => {
      this.isEditing = false;
      
      if (shouldSave) {
        const newLatex = (mathfield as any).getValue('latex');
        if (newLatex !== mathInfo.content) {
          this.updateMathInEditor(mathInfo, newLatex);
        }
      }
      
      buttonContainer.remove();
      (mathfield as any).readOnly = true;
      editButton.style.pointerEvents = 'auto';
      
      setTimeout(() => this.hideWidget(), 100);
    };

    const cancelBtn = buttonContainer.querySelector('.cancel-btn') as HTMLElement;
    const saveBtn = buttonContainer.querySelector('.save-btn') as HTMLElement;

    cancelBtn.addEventListener('click', () => finishEditing(false));
    saveBtn.addEventListener('click', () => finishEditing(true));

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishEditing(false);
        document.removeEventListener('keydown', handleKeydown);
      }
    };

    document.addEventListener('keydown', handleKeydown);
  }

  private createEditorButtons(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'math-editor-buttons';
    Object.assign(container.style, {
      marginTop: '12px',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      paddingTop: '8px',
      borderTop: '1px solid #e9ecef'
    });

    const cancelBtn = this.createButton('Cancel', 'cancel-btn', '#6c757d');
    const saveBtn = this.createButton('Save', 'save-btn', '#007acc');

    container.appendChild(cancelBtn);
    container.appendChild(saveBtn);

    return container;
  }

  private createButton(text: string, className: string, bgColor: string): HTMLElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = className;
    
    Object.assign(button.style, {
      border: 'none',
      borderRadius: '4px',
      padding: '8px 14px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '500',
      background: bgColor,
      color: 'white',
      transition: 'all 0.2s ease',
      minWidth: '60px'
    });

    button.addEventListener('mouseenter', () => {
      button.style.filter = 'brightness(0.9)';
      button.style.transform = 'translateY(-1px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.filter = 'brightness(1)';
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  private scheduleHide(): void {
    this.clearTimer && clearTimeout(this.clearTimer);
    this.clearTimer = window.setTimeout(() => {
      if (!this.isEditing) {
        this.hideWidget();
      }
    }, 200);
  }

  private hideWidget(): void {
    this.hoverTimer && clearTimeout(this.hoverTimer);
    this.clearTimer && clearTimeout(this.clearTimer);
    
    if (this.currentWidget?.parentNode) {
      this.currentWidget.parentNode.removeChild(this.currentWidget);
    }
    
    this.currentWidget = null;
    this.isEditing = false;
  }

  private updateMathInEditor(mathInfo: MathHoverInfo, newContent: string): void {
    const delimiter = mathInfo.isDisplay ? '$$' : '$';
    const newLatex = `${delimiter}${newContent}${delimiter}`;

    this.view.dispatch({
      changes: {
        from: mathInfo.from,
        to: mathInfo.to,
        insert: newLatex
      }
    });
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    this.view.dispatch({
      effects: setMathHoverEffect.of(enabled)
    });

    if (!enabled) {
      this.hideWidget();
    }
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  destroy(): void {
    this.hideWidget();
    this.setEnabled(false);
  }
}

export function createMathHoverExtension(): Extension {
  return [
    mathHoverEnabledField,
    EditorView.theme({
      '.math-hover-preview': {
        fontSize: '14px',
        lineHeight: '1.4'
      }
    })
  ];
}