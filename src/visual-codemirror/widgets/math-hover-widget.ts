// src/visual-codemirror/widgets/math-hover-widget.ts - Clean implementation
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
  private timer: number | null = null;

  constructor(view: EditorView) {
    this.view = view;
    this.view.dom.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isEnabled || this.isEditing) return;

    if (this.timer) clearTimeout(this.timer);

    this.timer = window.setTimeout(() => {
      const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos) {
        const math = this.findMath(pos);
        if (math) {
          this.showWidget(math, e.clientX, e.clientY);
        } else {
          this.hideWidget();
        }
      }
    }, 300);
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
    this.hideWidget();

    this.widget = document.createElement('div');
    this.widget.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: white;
      border: 2px solid #007acc;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      left: ${Math.min(x + 10, window.innerWidth - 300)}px;
      top: ${Math.max(y + 10, 10)}px;
      cursor: pointer;
    `;

    const mathfield = createEditableMath(math.content, math.isDisplay);
    (mathfield as any).readOnly = true;
    mathfield.style.pointerEvents = 'none';

    const editButton = document.createElement('button');
    editButton.innerHTML = '✏️';
    editButton.title = 'Edit math';
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
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      z-index: 1;
    `;

    this.widget.appendChild(mathfield);
    this.widget.appendChild(editButton);
    document.body.appendChild(this.widget);

    // Show edit button on hover
    this.widget.addEventListener('mouseenter', () => {
      if (this.timer) clearTimeout(this.timer);
      editButton.style.opacity = '1';
    });

    this.widget.addEventListener('mouseleave', () => {
      editButton.style.opacity = '0';
      if (!this.isEditing) {
        setTimeout(() => this.hideWidget(), 200);
      }
    });

    // Both widget and button can trigger editing
    this.widget.addEventListener('click', () => this.startEditing(math));
    editButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startEditing(math);
    });
  }

  private startEditing(math: MathInfo): void {
    if (!this.widget || this.isEditing) return;

    this.isEditing = true;

    // Smart positioning to avoid keyboard
    const currentTop = parseInt(this.widget.style.top);
    const keyboardSpace = 320;
    const minTop = 10;
    
    if (currentTop + 200 > window.innerHeight - keyboardSpace) {
      this.widget.style.top = Math.max(minTop, window.innerHeight - keyboardSpace - 220) + 'px';
    }

    // Rebuild widget for editing
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

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: #6c757d;
      color: white;
      cursor: pointer;
      font-size: 12px;
    `;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = `
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: #007acc;
      color: white;
      cursor: pointer;
      font-size: 12px;
    `;

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);
    this.widget.appendChild(mathfield);
    this.widget.appendChild(buttons);

    setTimeout(() => (mathfield as any).focus(), 100);

    const finish = (save: boolean) => {
      if (save) {
        const newContent = (mathfield as any).getValue('latex');
        if (newContent !== math.content) {
          const delimiter = math.isDisplay ? '$$' : '$';
          const newLatex = delimiter + newContent + delimiter;
          
          this.view.dispatch({
            changes: { from: math.from, to: math.to, insert: newLatex }
          });
        }
      }
      
      this.isEditing = false;
      this.hideWidget();
    };

    saveBtn.addEventListener('click', () => finish(true));
    cancelBtn.addEventListener('click', () => finish(false));

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    const clickHandler = (e: Event) => {
      const target = e.target as Element;
      const inWidget = this.widget?.contains(target);
      const inMathLive = target.closest('.ML__popover, .ML__menu, .ML__keyboard');
      
      if (!inWidget && !inMathLive) {
        finish(false);
        document.removeEventListener('click', clickHandler, true);
        document.removeEventListener('keydown', escHandler);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', clickHandler, true);
    }, 100);
  }

  private hideWidget(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.widget) {
      this.widget.remove();
      this.widget = null;
    }
    
    this.isEditing = false;
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
    this.hideWidget();
    this.setEnabled(false);
  }
}

export function createMathHoverExtension(): Extension {
  return [mathHoverEnabledField];
}