import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

import { DualLatexEditor, VisualCodeMirrorEditor } from '../../..';

import '../../../dist/styles.css';
import './styles.css';
import 'katex/dist/katex.min.css';

const initialLatex = `\\section{Introduction}
This is a sample document demonstrating the visual LaTeX editor.

\\subsection{Mathematical Expressions}
Here is an inline formula: $E = mc^2$, and here is a display formula:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

\\begin{theorem}
This is a theorem environment with some mathematical content: $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$.
\\end{theorem}

\\begin{proof}
The proof follows from...
\\end{proof}

\\section{Text Formatting}
This section demonstrates various \\textbf{formatting} and \\emph{emphasis} commands.`;

document.addEventListener('DOMContentLoaded', () => {
  setupSideBySideDemo();
  setupDualEditorDemo();
});

function setupSideBySideDemo() {
  const cmEditorSource = new EditorView({
    state: EditorState.create({
      doc: initialLatex,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping
      ]
    }),
    parent: document.getElementById('codemirror-editor')
  });

  const cmEditorVisual = new EditorView({
    state: EditorState.create({
      doc: initialLatex,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping
      ]
    }),
    parent: document.getElementById('prosemirror-editor')
  });

  const visualEditor = new VisualCodeMirrorEditor(cmEditorVisual, {
    showCommands: false
  });

  visualEditor.setVisualMode(true);

  let syncing = false;

  const syncFromSource = () => {
    if (syncing) return;
    syncing = true;
    const sourceText = cmEditorSource.state.doc.toString();
    const visualText = cmEditorVisual.state.doc.toString();

    if (sourceText !== visualText) {
      cmEditorVisual.dispatch({
        changes: { from: 0, to: cmEditorVisual.state.doc.length, insert: sourceText }
      });
    }
    syncing = false;
  };

  const syncFromVisual = () => {
    if (syncing) return;
    syncing = true;
    const sourceText = cmEditorSource.state.doc.toString();
    const visualText = cmEditorVisual.state.doc.toString();

    if (sourceText !== visualText) {
      cmEditorSource.dispatch({
        changes: { from: 0, to: cmEditorSource.state.doc.length, insert: visualText }
      });
    }
    syncing = false;
  };

  cmEditorSource.dispatch = ((originalDispatch) => {
    return (...args) => {
      originalDispatch.apply(cmEditorSource, args);
      const transaction = args[0];
      if (transaction && transaction.docChanged && !syncing) {
        setTimeout(syncFromSource, 10);
      }
    };
  })(cmEditorSource.dispatch.bind(cmEditorSource));

  cmEditorVisual.dispatch = ((originalDispatch) => {
    return (...args) => {
      originalDispatch.apply(cmEditorVisual, args);
      const transaction = args[0];
      if (transaction && transaction.docChanged && !syncing) {
        setTimeout(syncFromVisual, 10);
      }
    };
  })(cmEditorVisual.dispatch.bind(cmEditorVisual));
}

function setupDualEditorDemo() {
  const cmEditor = new EditorView({
    state: EditorState.create({
      doc: initialLatex,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping
      ]
    })
  });

  const dualEditor = new DualLatexEditor(
    document.getElementById('dual-editor'),
    cmEditor,
    {
      initialMode: 'source',
      showCommands: false,
      showToolbar: true,
      onModeChange: (mode) => {
        console.log('Mode changed to:', mode);
      }
    }
  );
}