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
    const mathfields = element.querySelectorAll('math-field');
    mathfields.forEach((mf: any) => {
      if (this.mathfieldEventMap.has(mf)) return;

      const handlers = {
        input: (e: any) => {
          if (!this.syncing) {
            setTimeout(() => this.handleMathfieldChange(mf), 10);
          }
        },
        change: (e: any) => {
          if (!this.syncing) {
            setTimeout(() => this.handleMathfieldChange(mf), 10);
          }
        },
        blur: (e: any) => {
          if (!this.syncing) {
            setTimeout(() => this.handleMathfieldChange(mf), 10);
          }
        }
      };

      this.mathfieldEventMap.set(mf, handlers);

      mf.addEventListener('input', handlers.input);
      mf.addEventListener('change', handlers.change);
      mf.addEventListener('blur', handlers.blur);

      mf.readOnly = false;
      mf.mathVirtualKeyboardPolicy = 'manual';
    });
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
    try {
      const pmPos = this.pmEditor.posAtDOM(mathfield, 0);
      if (pmPos >= 0) {
        const $pos = this.pmEditor.state.doc.resolve(pmPos);
        const node = $pos.nodeAfter;

        if (node && (node.type.name === 'math_inline' || node.type.name === 'math_display')) {
          const tr = this.pmEditor.state.tr.setNodeMarkup(
            pmPos,
            undefined,
            { ...node.attrs, latex: newLatex }
          );
          this.pmEditor.dispatch(tr);
        }
      }
    } catch (error) {
      console.warn('Error updating math node:', error);
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

      if (newLatex !== currentLatex) {
        const diffStart = this.findDiffStart(currentLatex, newLatex);
        if (diffStart === null) {
            this.syncing = false;
            return;
        }

        const { a: endA, b: endB } = this.findDiffEnd(currentLatex, newLatex);
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

  private findDiffEnd(a: string, b: string): { a: number, b: number } {
    let i = a.length;
    let j = b.length;
    while (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
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

    const mathfields = this.pmEditor.dom.querySelectorAll('math-field');
    mathfields.forEach((mf: any) => {
      const handlers = this.mathfieldEventMap.get(mf);
      if (handlers) {
        mf.removeEventListener('input', handlers.input);
        mf.removeEventListener('change', handlers.change);
        mf.removeEventListener('blur', handlers.blur);
        this.mathfieldEventMap.delete(mf);
      }
    });

    if (this.isListening && this.originalDispatch) {
      this.cmEditor.dispatch = this.originalDispatch;
      this.isListening = false;
    }
  }
}