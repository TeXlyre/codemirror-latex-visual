// src/visual-codemirror/visual-editor.ts (Phase 2 Updated)
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { StateField, StateEffect, Extension } from '@codemirror/state';
import { OverlayManager } from './overlay-manager';
import { ConfigService, DEFAULT_CONFIG } from '../core/config';
import { NestedContentRenderer } from './nested-content-renderer';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export interface VisualEditorOptions {
  showCommands?: boolean;
  onModeChange?: (mode: 'source' | 'visual') => void;
  config?: Partial<typeof DEFAULT_CONFIG>;
}

const toggleVisualEffect = StateEffect.define<boolean>();
const updateShowCommandsEffect = StateEffect.define<boolean>();

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

const showCommandsField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(updateShowCommandsEffect)) {
        return effect.value;
      }
    }
    return value;
  }
});

export class VisualCodeMirrorEditor {
  private cmEditor: EditorView;
  private options: VisualEditorOptions;
  private isVisualMode: boolean = false;
  private configService: ConfigService;
  private overlayManager: OverlayManager;
  private visualDecorationsField!: StateField<DecorationSet>;
  private cleanupFunctions: Array<() => void> = [];

  constructor(cmEditor: EditorView, options: VisualEditorOptions = {}) {
    this.cmEditor = cmEditor;
    this.options = options;

    this.configService = new ConfigService({
      ...DEFAULT_CONFIG,
      ...options.config
    });

    this.overlayManager = new OverlayManager(this.configService);

    this.initializeServices();
    this.createDecorationsField();
    this.setupExtensions();
  }

  private initializeServices(): void {
    try {
      NestedContentRenderer.initialize(this.configService);

      const configUnsubscribe = this.configService.subscribe(() => {
        if (this.isVisualMode) {
          this.refreshDecorations();
        }
      });

      this.cleanupFunctions.push(configUnsubscribe);

    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.ERROR,
        'Failed to initialize visual editor services',
        { error }
      );
    }
  }

  private createDecorationsField(): void {
    this.visualDecorationsField = StateField.define<DecorationSet>({
      create: (state) => {
        return Decoration.none;
      },

      update: (decorations, tr) => {
        const isVisual = tr.state.field(visualModeField);

        if (!isVisual) {
          return Decoration.none;
        }

        const shouldRecreate = tr.docChanged ||
          tr.effects.some(e => e.is(toggleVisualEffect) || e.is(updateShowCommandsEffect));

        if (shouldRecreate) {
          try {
            const showCommands = tr.state.field(showCommandsField);
            return this.overlayManager.createDecorations(tr.state, showCommands);
          } catch (error) {
            errorService.logError(
              ErrorCategory.RENDER,
              ErrorSeverity.ERROR,
              'Failed to update decorations',
              { error }
            );
            return Decoration.none;
          }
        }

        return decorations.map(tr.changes);
      },

      provide: f => EditorView.decorations.from(f)
    });
  }

  private setupExtensions(): void {
    const extensions: Extension[] = [
      visualModeField,
      showCommandsField,
      this.visualDecorationsField,
      this.createTheme()
    ];

    try {
      this.cmEditor.dispatch({
        effects: StateEffect.appendConfig.of(extensions)
      });
    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.ERROR,
        'Failed to setup visual editor extensions',
        { error }
      );
    }
  }

  private createTheme(): Extension {
    const config = this.configService.get();

    return EditorView.theme({
      '.latex-visual-widget': {
        display: 'inline-block',
        position: 'relative'
      },
      '.latex-visual-section': {
        display: 'block',
        fontWeight: 'bold',
        margin: config.styles.spacing.widget,
        borderBottom: `1px solid ${config.styles.colors.secondary}`,
        paddingBottom: '0.2em'
      },
      '.latex-visual-section-1': { fontSize: '1.8em' },
      '.latex-visual-section-2': { fontSize: '1.5em' },
      '.latex-visual-section-3': { fontSize: '1.2em' },
      '.latex-visual-math-inline': {
        background: 'none',
        border: 'none',
        margin: '0 1px',
        cursor: 'pointer'
      },
      '.latex-visual-math-display': {
        display: 'block',
        background: 'none',
        border: 'none',
        borderRadius: '4px',
        padding: config.styles.spacing.container,
        margin: config.styles.spacing.widget,
        textAlign: 'center',
        cursor: 'pointer'
      },
      '.latex-visual-environment': {
        display: 'block',
        margin: config.styles.spacing.widget,
        padding: config.styles.spacing.container,
        borderLeft: `3px solid ${config.styles.colors.environment}`,
        background: `${config.styles.colors.environment}0d`
      },
      '.latex-visual-command': {
        display: 'inline',
        padding: '1px 2px',
        borderRadius: '2px',
        background: `${config.styles.colors.command}1a`
      },
      '.latex-visual-command.textbf': { fontWeight: 'bold' },
      '.latex-visual-command.textit': { fontStyle: 'italic' },
      '.latex-visual-command.underline': { textDecoration: 'underline' },
      '.latex-visual-table': {
        display: 'block',
        margin: config.styles.spacing.widget
      }
    });
  }

  setVisualMode(enabled: boolean): void {
    if (this.isVisualMode === enabled) return;

    try {
      this.isVisualMode = enabled;

      this.cmEditor.dispatch({
        effects: [
          toggleVisualEffect.of(enabled),
          updateShowCommandsEffect.of(this.options.showCommands || false)
        ]
      });

      this.options.onModeChange?.(enabled ? 'visual' : 'source');

      if (enabled) {
        this.overlayManager.clearCache();
      }

    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.ERROR,
        'Failed to set visual mode',
        { enabled, error }
      );
    }
  }

  toggleMode(): void {
    this.setVisualMode(!this.isVisualMode);
  }

  updateOptions(options: VisualEditorOptions): void {
    this.options = { ...this.options, ...options };

    if (options.config) {
      this.configService.update(options.config);
    }

    if (this.isVisualMode) {
      try {
        this.cmEditor.dispatch({
          effects: [updateShowCommandsEffect.of(this.options.showCommands || false)]
        });
      } catch (error) {
        errorService.logError(
          ErrorCategory.STATE,
          ErrorSeverity.WARN,
          'Failed to update visual editor options',
          { options, error }
        );
      }
    }
  }

  private refreshDecorations(): void {
    if (this.isVisualMode) {
      this.overlayManager.clearCache();

      this.cmEditor.dispatch({
        effects: [updateShowCommandsEffect.of(this.options.showCommands || false)]
      });
    }
  }

  getPerformanceStats() {
    return {
      isVisualMode: this.isVisualMode,
      overlayCache: this.overlayManager.getCacheStats(),
      config: this.configService.get()
    };
  }

  destroy(): void {
    try {
      this.cleanupFunctions.forEach(cleanup => cleanup());
      this.cleanupFunctions = [];

      this.overlayManager.cleanup();
      NestedContentRenderer.cleanup();

      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.INFO,
        'VisualCodeMirrorEditor destroyed successfully'
      );
    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.ERROR,
        'Error during visual editor destruction',
        { error }
      );
    }
  }
}