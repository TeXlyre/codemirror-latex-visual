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

  constructor(cmEditor: EditorView, pmEditor: PMView) {
    this.cmEditor = cmEditor;
    this.pmEditor = pmEditor;
    this.positionMapper = new PositionMapper();
    this.setupCodeMirrorListener();
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
          setTimeout(() => this.syncToVisual(), 0);
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
    } finally {
      this.syncing = false;
    }
  }

  syncToSource() {
    if (this.syncing) return;
    this.syncing = true;

    try {
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

  handleProseMirrorChange(tr: Transaction) {
    if (!tr.docChanged || this.syncing) return;
    setTimeout(() => this.syncToSource(), 0);
  }

  destroy() {
    if (this.isListening && this.originalDispatch) {
      this.cmEditor.dispatch = this.originalDispatch;
      this.isListening = false;
    }
  }
}