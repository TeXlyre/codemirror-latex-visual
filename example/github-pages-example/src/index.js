import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

// Remove ProseMirror imports - no longer needed
// import { baseKeymap } from 'prosemirror-commands';
// import { keymap as pmKeymap } from 'prosemirror-keymap';
// import { parseLatexToProseMirror } from '../../../dist';
// import { latexVisualSchema } from '../../../dist';
// import { EditorView as PMView } from 'prosemirror-view';
// import { EditorState as PMState } from 'prosemirror-state';

// Update imports for new architecture
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
  // Source editor (unchanged)
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

  // Visual editor using new CodeMirror-based approach
  const visualCmEditor = new EditorView({
    state: EditorState.create({
      doc: initialLatex,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping
      ]
    }),
    parent: document.getElementById('prosemirror-editor') // Reuse the existing container
  });

  // Create visual editor that shows overlays
  const visualEditor = new VisualCodeMirrorEditor(visualCmEditor, {
    showCommands: false
  });

  // Set to visual mode immediately
  visualEditor.setVisualMode(true);

  // Optional: Sync changes between the two editors
  let syncing = false;

  const syncFromSource = () => {
    if (syncing) return;
    syncing = true;
    const sourceText = cmEditor.state.doc.toString();
    const visualText = visualCmEditor.state.doc.toString();

    if (sourceText !== visualText) {
      visualCmEditor.dispatch({
        changes: { from: 0, to: visualCmEditor.state.doc.length, insert: sourceText }
      });
    }
    syncing = false;
  };

  const syncFromVisual = () => {
    if (syncing) return;
    syncing = true;
    const sourceText = cmEditor.state.doc.toString();
    const visualText = visualCmEditor.state.doc.toString();

    if (sourceText !== visualText) {
      cmEditor.dispatch({
        changes: { from: 0, to: cmEditor.state.doc.length, insert: visualText }
      });
    }
    syncing = false;
  };

  // Set up bidirectional sync
  cmEditor.dispatch = ((originalDispatch) => {
    return (...args) => {
      originalDispatch.apply(cmEditor, args);
      const transaction = args[0];
      if (transaction && transaction.docChanged && !syncing) {
        setTimeout(syncFromSource, 10);
      }
    };
  })(cmEditor.dispatch.bind(cmEditor));

  visualCmEditor.dispatch = ((originalDispatch) => {
    return (...args) => {
      originalDispatch.apply(visualCmEditor, args);
      const transaction = args[0];
      if (transaction && transaction.docChanged && !syncing) {
        setTimeout(syncFromVisual, 10);
      }
    };
  })(visualCmEditor.dispatch.bind(visualCmEditor));
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