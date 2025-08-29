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
  private showCommands: boolean;
  private syncTimeout?: number;
  private pendingSync = false;

  constructor(cmEditor: EditorView, pmEditor: PMView, showCommands: boolean = false) {
    this.cmEditor = cmEditor;
    this.pmEditor = pmEditor;
    this.showCommands = showCommands;
    this.setupCodeMirrorListener();
    this.setupMathfieldListeners();
  }

  forceVisualRefresh() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const currentDoc = this.pmEditor.state.doc;
      const tr = this.pmEditor.state.tr.setMeta('forceRefresh', true);

      const latexContent = this.cmEditor.state.doc.toString();
      const newPmDoc = parseLatexToProseMirror(latexContent);

      const fullReplace = tr.replaceWith(0, currentDoc.content.size, newPmDoc.content);
      this.pmEditor.dispatch(fullReplace);

      setTimeout(() => {
        this.attachMathfieldListeners(this.pmEditor.dom);
      }, 50);
    } finally {
      this.syncing = false;
    }
  }

  updateCommandVisibility(showCommands: boolean) {
    this.showCommands = showCommands;
    (window as any).latexEditorShowCommands = showCommands;
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
      if (!mathfield) return;

      const originalLatex = mathfield.getAttribute('data-original-latex') || mathfield.getValue('latex');
      mathfield.setAttribute('data-original-latex', originalLatex);

      const handlers = {
        containerClick: (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          this.startMathEditing(mathfield);
        },
        mathfieldClick: (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          this.startMathEditing(mathfield);
        }
      };

      this.mathfieldEventMap.set(container, handlers);
      container.addEventListener('click', handlers.containerClick, true);
      mathfield.addEventListener('click', handlers.mathfieldClick, true);

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
    floatingContainer.style.left = `${rect.left - 10}px`;
    floatingContainer.style.top = `${rect.top - 10}px`;
    floatingContainer.style.width = `${Math.max(rect.width + 20, 250)}px`;

    const newMathfield = document.createElement('math-field');
    newMathfield.className = isDisplayMode ? 'math-display-field editing' : 'math-inline-field editing';

    (newMathfield as any).readOnly = false;
    (newMathfield as any).mathVirtualKeyboardPolicy = 'auto';
    (newMathfield as any).value = currentValue;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'math-editor-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'math-editor-btn math-editor-btn-cancel';

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done';
    doneBtn.className = 'math-editor-btn math-editor-btn-done';

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
        const oldLatex = mathfield.getAttribute('data-original-latex') || '';
        const newValue = floatingMathfield.getValue('latex');

        mathfield.value = newValue;
        mathfield.setAttribute('data-original-latex', newValue);

        if (newValue !== oldLatex) {
          this.updateMathNodeFromMathfield(mathfield, newValue);
        }
      }

      document.body.removeChild(floatingContainer);
      delete mathfield._floatingContainer;
      delete mathfield._floatingMathfield;
    }
  }

  private updateMathNodeFromMathfield(mathfield: any, newLatex: string) {
    if (this.syncing) return;

    try {
      this.syncing = true;

      const container = mathfield.closest('.math-inline-container, .math-display-container');
      if (!container) {
        this.syncing = false;
        return;
      }

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

          const newState = this.pmEditor.state.apply(tr);
          this.pmEditor.updateState(newState);

          this.syncing = false;
          this.syncToSource(tr);

          setTimeout(() => {
            this.attachMathfieldListeners(this.pmEditor.dom);
          }, 50);
        } else {
          this.syncing = false;
        }
      } else {
        this.syncing = false;
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

      if (!this.syncing && !this.pendingSync) {
        const transactions = (Array.isArray(args[0]) ? args[0] : [args[0]]).filter(Boolean);
        const docChangedTransactions = transactions.filter(tr => tr && tr.docChanged);

        if (docChangedTransactions.length > 0) {
          this.debouncedSyncToVisual();
        }
      }
    };

    this.isListening = true;
  }

  private debouncedSyncToVisual() {
    this.pendingSync = true;

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = window.setTimeout(() => {
      this.pendingSync = false;
      if (!this.syncing) {
        this.syncToVisual();
      }
    }, 150);
  }

  syncToVisualWithCommandToggle() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const latexContent = this.cmEditor.state.doc.toString();
      const newPmDoc = parseLatexToProseMirror(latexContent, this.showCommands);

      const tr = this.pmEditor.state.tr.replaceWith(
        0,
        this.pmEditor.state.doc.content.size,
        newPmDoc.content
      );

      this.pmEditor.dispatch(tr);

      setTimeout(() => {
        this.attachMathfieldListeners(this.pmEditor.dom);
      }, 50);
    } finally {
      this.syncing = false;
    }
  }

  syncToVisual() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const latexContent = this.cmEditor.state.doc.toString();

      if (!latexContent.trim()) {
        const emptyDoc = this.pmEditor.state.schema.nodes.doc.create({}, [
          this.pmEditor.state.schema.nodes.paragraph.create()
        ]);

        this.pmEditor.dispatch(
          this.pmEditor.state.tr.replaceWith(0, this.pmEditor.state.doc.content.size, emptyDoc.content)
        );
        return;
      }

      const newPmDoc = parseLatexToProseMirror(latexContent, this.showCommands);
      const oldPmDoc = this.pmEditor.state.doc;

      if (newPmDoc.eq(oldPmDoc)) return;

      try {
        const diffStart = oldPmDoc.content.findDiffStart(newPmDoc.content);
        if (diffStart !== null) {
          const diffEnd = oldPmDoc.content.findDiffEnd(newPmDoc.content);
          if (diffEnd && diffStart <= diffEnd.a && diffStart <= diffEnd.b) {
            let { a: endA, b: endB } = diffEnd;
            const tr = this.pmEditor.state.tr.replace(diffStart, endA, newPmDoc.slice(diffStart, endB));
            this.pmEditor.dispatch(tr);
          } else {
            throw new Error('Invalid diff boundaries');
          }
        }
      } catch (diffError) {
        const tr = this.pmEditor.state.tr.replaceWith(
          0,
          this.pmEditor.state.doc.content.size,
          newPmDoc.content
        );
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
      const newLatex = renderProseMirrorToLatex(this.pmEditor.state.doc, this.showCommands);
      const currentLatex = this.cmEditor.state.doc.toString();

      if (newLatex !== currentLatex) {
        try {
          const diffStart = this.findDiffStart(currentLatex, newLatex);
          if (diffStart !== null) {
            const { a: endA, b: endB } = this.findDiffEnd(currentLatex, newLatex, diffStart);
            if (diffStart <= endA && diffStart <= endB) {
              const insertText = newLatex.slice(diffStart, endB);
              const cmTr = this.cmEditor.state.update({
                changes: { from: diffStart, to: endA, insert: insertText }
              });
              this.cmEditor.dispatch(cmTr);
            } else {
              throw new Error('Invalid diff boundaries');
            }
          }
        } catch (diffError) {
          const cmTr = this.cmEditor.state.update({
            changes: { from: 0, to: this.cmEditor.state.doc.length, insert: newLatex }
          });
          this.cmEditor.dispatch(cmTr);
        }
      }
    } catch (error) {
      console.warn('Error syncing to source:', error);
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
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

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
        container.removeEventListener('click', handlers.containerClick, true);
        if (mathfield) {
          mathfield.removeEventListener('click', handlers.mathfieldClick, true);
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