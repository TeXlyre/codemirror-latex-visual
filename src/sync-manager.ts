import { EditorView } from '@codemirror/view';
import { EditorView as PMView } from 'prosemirror-view';
import { Transaction } from 'prosemirror-state';
import { parseLatexToProseMirror, renderProseMirrorToLatex } from './latex-parser';
import { PositionMapper } from './position-mapper';

export class SyncManager {
  private cmEditor: EditorView;
  private pmEditor: PMView;
  private positionMapper: PositionMapper;
  public syncing = false;
  private isListening = false;
  private originalDispatch: any;
  private mathfieldObserver?: MutationObserver;
  private mathfieldEventMap = new WeakMap();

  constructor(cmEditor: EditorView, pmEditor: PMView) {
    this.cmEditor = cmEditor;
    this.pmEditor = pmEditor;
    this.positionMapper = new PositionMapper();
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
      setTimeout(() => this.syncToSource(), 50);
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
      const result = this.originalDispatch(...args);

      if (!this.syncing) {
        const firstArg = args[0];
        let hasDocChange = false;

        if (Array.isArray(firstArg)) {
          hasDocChange = firstArg.some((tr: any) => tr.docChanged);
        } else if (firstArg && typeof firstArg === 'object') {
          if ('docChanged' in firstArg) {
            hasDocChange = firstArg.docChanged;
          } else if ('changes' in firstArg) {
            hasDocChange = Boolean(firstArg.changes);
          }
        }

        if (hasDocChange) {
          setTimeout(() => this.syncToVisual(), 50);
        }
      }

      return result;
    };

    this.isListening = true;
  }

  syncToVisual() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const latexContent = this.cmEditor.state.doc.toString();
      const pmDoc = parseLatexToProseMirror(latexContent);

      const tr = this.pmEditor.state.tr.replaceWith(
        0,
        this.pmEditor.state.doc.content.size,
        pmDoc.content
      );

      this.pmEditor.dispatch(tr);
      this.positionMapper.buildMapping(latexContent, pmDoc);

      setTimeout(() => {
        this.attachMathfieldListeners(this.pmEditor.dom);
        this.initializeMathfieldValues();
      }, 100);
    } finally {
      this.syncing = false;
    }
  }

  private initializeMathfieldValues() {
    const mathfields = this.pmEditor.dom.querySelectorAll('math-field');
    mathfields.forEach((mf: any) => {
      const currentLatex = mf.getValue('latex');
      mf.setAttribute('data-original-latex', currentLatex);
      mf.readOnly = false;
      mf.mathVirtualKeyboardPolicy = 'manual';
    });
  }

  syncToSource() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      this.updateMathfieldValues();
      const newLatex = renderProseMirrorToLatex(this.pmEditor.state.doc);
      const currentLatex = this.cmEditor.state.doc.toString();

      if (newLatex !== currentLatex) {
        const tr = this.cmEditor.state.update({
          changes: {
            from: 0,
            to: this.cmEditor.state.doc.length,
            insert: newLatex
          }
        });
        this.cmEditor.dispatch(tr);
      }
    } finally {
      this.syncing = false;
    }
  }

  private updateMathfieldValues() {
    const mathfields = this.pmEditor.dom.querySelectorAll('math-field');
    mathfields.forEach((mf: any) => {
      const currentValue = mf.getValue('latex');
      const originalValue = mf.getAttribute('data-original-latex') || '';

      if (currentValue !== originalValue) {
        this.updateMathNodeFromMathfield(mf, currentValue);
      }
    });
  }

  handleProseMirrorChange(tr: Transaction) {
    if (!tr.docChanged || this.syncing) return;
    setTimeout(() => this.syncToSource(), 50);
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