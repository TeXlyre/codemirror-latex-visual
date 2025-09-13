// src/visual-codemirror/widgets/math-hover-widget.ts - Clean simple implementation
import { EditorView } from '@codemirror/view';
import { StateField, StateEffect, Extension } from '@codemirror/state';
import { createEditableMath } from '../../math-field-utils';

interface MathInfo {
  from: number;
  to: number;
  content: string;
  isDisplay: boolean;
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
  private isEnabled: boolean = false;
  private widget: HTMLElement | null = null;
  private isEditing: boolean = false;
  private checkTimer: number | null = null;

  constructor(view: EditorView) {
    this.view = view;
    
    // Simple approach: check regularly for both mouse and cursor
    this.startChecking();
  }

  private startChecking(): void {
    // Check every 200ms for either hover or cursor in math
    const check = () => {
      if (this.isEnabled && !this.isEditing) {
        this.checkForMath();
      }
      this.checkTimer = window.setTimeout(check, 200);
    };
    
    check();
  }

  private checkForMath(): void {
    const cursorPos = this.view.state.selection.main.from;
    const cursorMath = this.findMath(cursorPos);
    
    if (cursorMath) {
      // Show widget near cursor
      const coords = this.view.coordsAtPos(cursorPos);
      if (coords) {
        this.showWidget(cursorMath, coords.left + 20, coords.top - 10);
      }
      return;
    }

    // Check mouse position if available
    const mousePos = this.getMousePosition();
    if (mousePos) {
      const mouseMath = this.findMath(mousePos);
      if (mouseMath) {
        const coords = this.view.coordsAtPos(mousePos);
        if (coords) {
          this.showWidget(mouseMath, coords.left + 10, coords.top - 10);
        }
        return;
      }
    }

    // No math found, hide widget
    if (this.widget && !this.widget.matches(':hover')) {
      this.hideWidget();
    }
  }

  private getMousePosition(): number | null {
    // Get current mouse coordinates if available
    const rect = this.view.dom.getBoundingClientRect();
    const lastMouseEvent = (window as any).lastMouseEvent;
    
    if (lastMouseEvent && 
        lastMouseEvent.clientX >= rect.left && 
        lastMouseEvent.clientX <= rect.right &&
        lastMouseEvent.clientY >= rect.top && 
        lastMouseEvent.clientY <= rect.bottom) {
      
      return this.view.posAtCoords({ 
        x: lastMouseEvent.clientX, 
        y: lastMouseEvent.clientY 
      });
    }
    
    return null;
  }

  private findMath(pos: number): MathInfo | null {
    const text = this.view.state.doc.toString();
    
    // Find display math $$...$$
    let regex = /\$\$([^$]+?)\$\$/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (pos >= match.index && pos <= match.index + match[0].length) {
        return {
          from: match.index,
          to: match.index + match[0].length,
          content: match[1],
          isDisplay: true
        };
      }
    }
    
    // Find inline math $...$
    regex = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
    while ((match = regex.exec(text)) !== null) {
      if (pos >= match.index && pos <= match.index + match[0].length) {
        return {
          from: match.index,
          to: match.index + match[0].length,
          content: match[1],
          isDisplay: false
        };
      }
    }
    
    return null;
  }

  private showWidget(math: MathInfo, x: number, y: number): void {
    // Don't recreate if same math
    if (this.widget && this.widget.dataset.mathContent === math.content) {
      return;
    }

    this.hideWidget();

    this.widget = document.createElement('div');
    this.widget.dataset.mathContent = math.content;
    this.widget.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: white;
      border: 2px solid #007acc;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      left: ${Math.min(x, window.innerWidth - 300)}px;
      top: ${Math.max(y, 10)}px;
      cursor: pointer;
    `;

    const mathfield = createEditableMath(math.content, math.isDisplay);
    (mathfield as any).readOnly = true;
    mathfield.style.pointerEvents = 'none';

    const editButton = document.createElement('button');
    editButton.innerHTML = '✏️';
    editButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      background: #007acc;
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      font-size: 12px;
      z-index: 1;
    `;

    this.widget.appendChild(mathfield);
    this.widget.appendChild(editButton);
    document.body.appendChild(this.widget);

    // Show button on hover
    this.widget.addEventListener('mouseenter', () => {
      editButton.style.opacity = '1';
    });

    this.widget.addEventListener('mouseleave', () => {
      editButton.style.opacity = '0';
    });

    // Click handlers
    this.widget.addEventListener('click', () => this.edit(math));
    editButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.edit(math);
    });
  }

  private edit(math: MathInfo): void {
    if (!this.widget || this.isEditing) return;

    this.isEditing = true;

    // Smart positioning to avoid keyboard
    const currentTop = parseInt(this.widget.style.top);
    if (currentTop > window.innerHeight - 400) {
      this.widget.style.top = Math.max(10, window.innerHeight - 400) + 'px';
    }

    this.widget.innerHTML = '';
    this.widget.style.cursor = 'auto';

    const mathfield = createEditableMath(math.content, math.isDisplay);
    (mathfield as any).readOnly = false;

    const buttons = document.createElement('div');
    buttons.style.cssText = `
      margin-top: 12px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      border-top: 1px solid #eee;
      padding-top: 8px;
    `;

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = `
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: #6c757d;
      color: white;
      cursor: pointer;
    `;

    const save = document.createElement('button');
    save.textContent = 'Save';
    save.style.cssText = `
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: #007acc;
      color: white;
      cursor: pointer;
    `;

    buttons.appendChild(cancel);
    buttons.appendChild(save);
    this.widget.appendChild(mathfield);
    this.widget.appendChild(buttons);

    setTimeout(() => (mathfield as any).focus(), 100);

    const finish = (doSave: boolean) => {
      if (doSave) {
        const newContent = (mathfield as any).getValue('latex');
        const delimiter = math.isDisplay ? '$$' : '$';
        const newLatex = delimiter + newContent + delimiter;
        
        this.view.dispatch({
          changes: { from: math.from, to: math.to, insert: newLatex }
        });
      }
      
      this.isEditing = false;
      this.hideWidget();
    };

    save.addEventListener('click', () => finish(true));
    cancel.addEventListener('click', () => finish(false));

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    const outsideHandler = (e: Event) => {
      const target = e.target as Element;
      if (!this.widget?.contains(target) && !target.closest('.ML__popover, .ML__menu, .ML__keyboard')) {
        finish(false);
        document.removeEventListener('click', outsideHandler, true);
        document.removeEventListener('keydown', escHandler);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', outsideHandler, true);
    }, 100);
  }

  private hideWidget(): void {
    if (this.widget) {
      this.widget.remove();
      this.widget = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) this.hideWidget();
    
    this.view.dispatch({
      effects: setMathHoverEffect.of(enabled)
    });
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  destroy(): void {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
    }
    this.hideWidget();
    this.setEnabled(false);
  }
}

// Track mouse position globally for hover detection
if (typeof window !== 'undefined') {
  document.addEventListener('mousemove', (e) => {
    (window as any).lastMouseEvent = e;
  });
}

export function createMathHoverExtension(): Extension {
  return [mathHoverEnabledField];
}