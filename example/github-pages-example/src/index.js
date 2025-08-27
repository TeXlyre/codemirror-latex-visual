import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { baseKeymap } from 'prosemirror-commands';
import { keymap as pmKeymap } from 'prosemirror-keymap';

import { DualLatexEditor, SyncManager } from '../../..';
import { parseLatexToProseMirror } from '../../../dist';
import { latexVisualSchema } from '../../../dist';
import { EditorView as PMView } from 'prosemirror-view';
import { EditorState as PMState } from 'prosemirror-state';

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
  const cmEditor = new EditorView({
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

  const pmState = PMState.create({
    schema: latexVisualSchema,
    doc: parseLatexToProseMirror(initialLatex),
    plugins: [
      pmKeymap(baseKeymap)
    ]
  });

  const pmEditor = new PMView(document.getElementById('prosemirror-editor'), {
    state: pmState,
    dispatchTransaction: (tr) => {
      const newState = pmEditor.state.apply(tr);
      pmEditor.updateState(newState);

      if (tr.docChanged && !syncManager.syncing) {
        syncManager.handleProseMirrorChange(tr);
      }
    }
  });

  const syncManager = new SyncManager(cmEditor, pmEditor);
  syncManager.syncToVisual();
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
      onModeChange: (mode) => {
        console.log('Mode changed to:', mode);
      }
    }
  );
}