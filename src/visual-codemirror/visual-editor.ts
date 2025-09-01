import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { StateField, StateEffect, Extension } from '@codemirror/state';
import { OverlayManager } from './overlay-manager';

export interface VisualEditorOptions {
  showCommands?: boolean;
  onModeChange?: (mode: 'source' | 'visual') => void;
}

const toggleVisualEffect = StateEffect.define<boolean>();

const visualModeField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(toggleVisualEffect)) {
        return effect.value;
      }
    }
    return value;
  }
});

const visualDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return Decoration.none;
  },
  update(decorations, tr) {
    const isVisual = tr.state.field(visualModeField);

    if (!isVisual) {
      return Decoration.none;
    }

    if (tr.docChanged || tr.effects.some(e => e.is(toggleVisualEffect))) {
      const overlayManager = new OverlayManager();
      return overlayManager.createDecorations(tr.state);
    }

    return decorations.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f)
});

export class VisualCodeMirrorEditor {
  private cmEditor: EditorView;
  private options: VisualEditorOptions;
  private isVisualMode: boolean = false;

  constructor(cmEditor: EditorView, options: VisualEditorOptions = {}) {
    this.cmEditor = cmEditor;
    this.options = options;
    this.setupExtensions();
  }

  private setupExtensions() {
    const extensions: Extension[] = [
      visualModeField,
      visualDecorationsField,
      EditorView.theme({
        '.latex-visual-widget': {
          display: 'inline-block',
          position: 'relative'
        },
        '.latex-visual-section': {
          display: 'block',
          fontWeight: 'bold',
          margin: '1em 0 0.5em 0',
          borderBottom: '1px solid #ddd',
          paddingBottom: '0.2em'
        },
        '.latex-visual-section-1': { fontSize: '1.8em' },
        '.latex-visual-section-2': { fontSize: '1.5em' },
        '.latex-visual-section-3': { fontSize: '1.2em' },
        '.latex-visual-math-inline': {
          background: 'rgba(0, 123, 255, 0.1)',
          border: '1px solid rgba(0, 123, 255, 0.3)',
          borderRadius: '3px',
          padding: '2px 4px',
          margin: '0 1px',
          cursor: 'pointer'
        },
        '.latex-visual-math-display': {
          display: 'block',
          background: 'rgba(0, 123, 255, 0.05)',
          border: '1px solid rgba(0, 123, 255, 0.2)',
          borderRadius: '4px',
          padding: '10px',
          margin: '10px 0',
          textAlign: 'center',
          cursor: 'pointer'
        },
        '.latex-visual-environment': {
          display: 'block',
          margin: '10px 0',
          padding: '10px',
          borderLeft: '3px solid #28a745',
          background: 'rgba(40, 167, 69, 0.05)'
        },
        '.latex-visual-command': {
          display: 'inline',
          padding: '1px 2px',
          borderRadius: '2px',
          background: 'rgba(0, 123, 255, 0.1)'
        },
        '.latex-visual-command.textbf': { fontWeight: 'bold' },
        '.latex-visual-command.textit': { fontStyle: 'italic' },
        '.latex-visual-command.underline': { textDecoration: 'underline' },
        '.latex-visual-table': {
          display: 'block',
          margin: '10px 0'
        }
      })
    ];

    this.cmEditor.dispatch({
      effects: StateEffect.appendConfig.of(extensions)
    });
  }

  setVisualMode(enabled: boolean) {
    if (this.isVisualMode === enabled) return;

    this.isVisualMode = enabled;

    this.cmEditor.dispatch({
      effects: [toggleVisualEffect.of(enabled)]
    });

    this.options.onModeChange?.(enabled ? 'visual' : 'source');
  }

  toggleMode() {
    this.setVisualMode(!this.isVisualMode);
  }

  updateOptions(options: VisualEditorOptions) {
    this.options = { ...this.options, ...options };
  }

  destroy() {
    // Cleanup if needed
  }
}