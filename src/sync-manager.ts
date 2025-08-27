import { EditorView } from '@codemirror/view';
import { EditorView as PMView } from 'prosemirror-view';
import { Transaction } from 'prosemirror-state';
import { parseLatexToProseMirror, renderProseMirrorToLatex } from './latex-parser';

export class SyncManager {
  private cmEditor: EditorView;
  private pmEditor: PMView;
  public syncing = false;
  private isListening = false;
  private originalDispatch: any;
  private mathfieldObserver?: MutationObserver;
  private mathfieldEventMap = new WeakMap();

  constructor(cmEditor: EditorView, pmEditor: PMView) {
    this.cmEditor = cmEditor;
    this.pmEditor = pmEditor;
    this.setupCodeMirrorListener();
    this.setupMathfieldListeners();
  }

  private setupMathfieldListeners() {
    this.mathfieldObserver = new MutationObserver((mutations) => {
      if (this.syncing) return;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.attachMathfieldListeners(node as Element);
            }
          });
        }
      }
    });

    this.mathfieldObserver.observe(this.pmEditor.dom, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      this.attachMathfieldListeners(this.pmEditor.dom);
    }, 100);
  }

  private attachMathfieldListeners(element: Element) {
    const mathContainers = element.querySelectorAll('.math-inline-container, .math-display-container');
    mathContainers.forEach((container: Element) => {
      if (this.mathfieldEventMap.has(container)) return;

      const mathfield = container.querySelector('math-field') as any;
      const editBtn = container.querySelector('.math-edit-btn') as HTMLButtonElement;

      if (!mathfield || !editBtn) return;

      const originalLatex = mathfield.getAttribute('data-original-latex') || mathfield.getValue('latex');
      mathfield.setAttribute('data-original-latex', originalLatex);

      const handlers = {
        click: (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          this.startMathEditing(mathfield);
        }
      };

      this.mathfieldEventMap.set(container, handlers);
      editBtn.addEventListener('click', handlers.click);

      mathfield.readOnly = true;
      mathfield.mathVirtualKeyboardPolicy = 'manual';
    });
  }

  private startMathEditing(mathfield: any) {
    if (mathfield._editing) return;

    mathfield._editing = true;

    const rect = mathfield.getBoundingClientRect();
    const currentValue = mathfield.getValue('latex');
    const isDisplayMode = mathfield.classList.contains('math-display-field');

    const floatingContainer = document.createElement('div');
    floatingContainer.className = 'mathfield-editor-overlay';
    floatingContainer.style.cssText = `
      position: fixed;
      left: ${rect.left - 10}px;
      top: ${rect.top - 10}px;
      width: ${Math.max(rect.width + 20, 120)}px;
      min-height: ${rect.height + 20}px;
      z-index: 10000;
      background: white;
      border: 2px solid #007acc;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      padding: 10px;
    `;

    const newMathfield = document.createElement('math-field');
    if (isDisplayMode) {
      newMathfield.className = 'math-display-field';
      newMathfield.style.cssText = 'display: block; width: 100%; min-height: 2em;';
    } else {
      newMathfield.className = 'math-inline-field';
      newMathfield.style.cssText = 'display: inline-block; min-width: 4em; width: 100%;';
    }

    (newMathfield as any).readOnly = false;
    (newMathfield as any).mathVirtualKeyboardPolicy = 'auto';
    (newMathfield as any).value = currentValue;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin-top: 8px; text-align: right;';

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done';
    doneBtn.style.cssText = `
      background: #007acc;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 12px;
      margin-left: 6px;
      cursor: pointer;
      font-size: 12px;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 12px;
    `;

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(doneBtn);
    floatingContainer.appendChild(newMathfield);
    floatingContainer.appendChild(buttonContainer);
    document.body.appendChild(floatingContainer);

    mathfield._floatingContainer = floatingContainer;
    mathfield._floatingMathfield = newMathfield;

    setTimeout(() => {
      (newMathfield as any).focus();
    }, 10);

    const finishEditing = (save: boolean = true) => {
      if (!mathfield._editing) return;
      this.finishMathEditing(mathfield, save);
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

    const handleClickOutside = (e: Event) => {
      if (!floatingContainer.contains(e.target as Node)) {
        finishEditing(true);
        document.removeEventListener('mousedown', handleClickOutside, true);
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 100);
  }

  private finishMathEditing(mathfield: any, save: boolean) {
    if (!mathfield._editing) return;

    mathfield._editing = false;

    const floatingMathfield = mathfield._floatingMathfield;
    const floatingContainer = mathfield._floatingContainer;

    if (floatingMathfield && floatingContainer) {
      if (save) {
        const newValue = floatingMathfield.getValue('latex');
        mathfield.value = newValue;
        mathfield.setAttribute('data-original-latex', newValue);

        setTimeout(() => {
          if (!this.syncing) {
            this.handleMathfieldChange(mathfield);
          }
        }, 10);
      }

      document.body.removeChild(floatingContainer);
      delete mathfield._floatingContainer;
      delete mathfield._floatingMathfield;
    }

    setTimeout(() => {
      this.syncing = false;
    }, 100);
  }

  private handleMathfieldChange(mathfield: any) {
    if (this.syncing) return;

    const newLatex = mathfield.getValue('latex');
    const oldLatex = mathfield.getAttribute('data-original-latex') || '';

    if (newLatex !== oldLatex) {
      mathfield.setAttribute('data-original-latex', newLatex);
      this.updateMathNodeFromMathfield(mathfield, newLatex);
    }
  }

  private updateMathNodeFromMathfield(mathfield: any, newLatex: string) {
    if (this.syncing) return;

    try {
      this.syncing = true;

      const container = mathfield.closest('.math-inline-container, .math-display-container');
      if (!container) return;

      const pmPos = this.pmEditor.posAtDOM(container, 0);
      if (pmPos >= 0) {
        const $pos = this.pmEditor.state.doc.resolve(pmPos);
        const node = $pos.nodeAfter;

        if (node && (node.type.name === 'math_inline' || node.type.name === 'math_display')) {
          const tr = this.pmEditor.state.tr.setNodeMarkup(
            pmPos,
            undefined,
            { ...node.attrs, latex: newLatex }
          );

          // Use the same dispatch mechanism that triggers the original sync flow
          this.pmEditor.dispatch(tr);

          // Let the normal transaction handling take care of syncing
          setTimeout(() => {
            this.syncing = false;
            this.attachMathfieldListeners(this.pmEditor.dom);
          }, 100);
        }
      }
    } catch (error) {
      console.warn('Error updating math node:', error);
      this.syncing = false;
    }
  }

  private setupCodeMirrorListener() {
    if (this.isListening) return;

    this.originalDispatch = this.cmEditor.dispatch.bind(this.cmEditor);

    this.cmEditor.dispatch = (...args: any[]) => {
      this.originalDispatch(...args);

      if (!this.syncing) {
        const transactions = (Array.isArray(args[0]) ? args[0] : [args[0]]).filter(Boolean);
        const docChangedTransactions = transactions.filter(tr => tr.docChanged);

        if (docChangedTransactions.length > 0) {
          this.syncToVisual();
        }
      }
    };

    this.isListening = true;
  }

  syncToVisual() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const latexContent = this.cmEditor.state.doc.toString();
      const newPmDoc = parseLatexToProseMirror(latexContent);
      const oldPmDoc = this.pmEditor.state.doc;

      const diffStart = oldPmDoc.content.findDiffStart(newPmDoc.content);
      if (diffStart === null) {
        this.syncing = false;
        return;
      }

      const diffEnd = oldPmDoc.content.findDiffEnd(newPmDoc.content);
      if (diffEnd) {
        let { a: endA, b: endB } = diffEnd;
        const tr = this.pmEditor.state.tr.replace(diffStart, endA, newPmDoc.slice(diffStart, endB));
        this.pmEditor.dispatch(tr);
      }

      setTimeout(() => {
        this.attachMathfieldListeners(this.pmEditor.dom);
      }, 50);
    } finally {
      this.syncing = false;
    }
  }

  syncToSource(tr?: Transaction) {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const newLatex = renderProseMirrorToLatex(this.pmEditor.state.doc);
      const currentLatex = this.cmEditor.state.doc.toString();

      console.log('Syncing to source:', { newLatex, currentLatex, different: newLatex !== currentLatex });

      if (newLatex !== currentLatex) {
        const diffStart = this.findDiffStart(currentLatex, newLatex);
        if (diffStart === null) {
            this.syncing = false;
            return;
        }

        const { a: endA, b: endB } = this.findDiffEnd(currentLatex, newLatex, diffStart);
        const insertText = newLatex.slice(diffStart, endB);

        const cmTr = this.cmEditor.state.update({
          changes: { from: diffStart, to: endA, insert: insertText }
        });
        this.cmEditor.dispatch(cmTr);
      }
    } finally {
      this.syncing = false;
    }
  }

  private findDiffStart(a: string, b: string): number | null {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) {
      i++;
    }
    return i === a.length && i === b.length ? null : i;
  }

  private findDiffEnd(a: string, b: string, diffStart: number): { a: number, b: number } {
    let i = a.length;
    let j = b.length;
    while (i > diffStart && j > diffStart && a[i - 1] === b[j - 1]) {
      i--;
      j--;
    }
    return { a: i, b: j };
  }

  handleProseMirrorChange(tr: Transaction) {
    if (!tr.docChanged || this.syncing) return;
    this.syncToSource(tr);
  }

  destroy() {
    if (this.mathfieldObserver) {
      this.mathfieldObserver.disconnect();
    }

    const mathContainers = this.pmEditor.dom.querySelectorAll('.math-inline-container, .math-display-container');
    mathContainers.forEach((container: Element) => {
      const mathfield = container.querySelector('math-field') as any;
      if (mathfield && mathfield._editing) {
        this.finishMathEditing(mathfield, false);
      }

      const handlers = this.mathfieldEventMap.get(container);
      if (handlers) {
        const editBtn = container.querySelector('.math-edit-btn') as HTMLButtonElement;
        if (editBtn) {
          editBtn.removeEventListener('click', handlers.click);
        }
        this.mathfieldEventMap.delete(container);
      }
    });

    if (this.isListening && this.originalDispatch) {
      this.cmEditor.dispatch = this.originalDispatch;
      this.isListening = false;
    }
  }
}