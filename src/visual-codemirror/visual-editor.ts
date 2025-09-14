// src/visual-codemirror/visual-editor.ts
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { StateField, StateEffect, Extension, Compartment } from '@codemirror/state';
import { OverlayManager } from './overlay-manager';
import { ConfigService, DEFAULT_CONFIG, LatexEditorConfig } from '../core/config';
import { NestedContentRenderer } from './nested-content-renderer';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export interface VisualEditorOptions {
  showCommands?: boolean;
  onModeChange?: (mode: 'source' | 'visual') => void;
  config?: Partial<LatexEditorConfig>;
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
  private themeCompartment = new Compartment();

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
      this.themeCompartment.of(this.createTheme())
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
    const colors = config.styles.colors;
    const isDark = config.theme === 'dark';

    return EditorView.theme({
      '&.cm-editor': {
        backgroundColor: colors.background,
        color: colors.foreground
      },
      '.cm-content': {
        backgroundColor: colors.background,
        color: colors.foreground
      },
      '.cm-focused': {
        outline: `2px solid ${colors.primary}`
      },
      '.cm-cursor': {
        borderLeftColor: colors.foreground
      },
      '.cm-selectionBackground': {
        backgroundColor: isDark ? 'rgba(74, 166, 255, 0.3)' : 'rgba(0, 122, 204, 0.2)'
      },
      '.latex-visual-widget': {
        display: 'inline-block',
        position: 'relative',
        color: colors.foreground
      },
      '.latex-visual-section': {
        display: 'block',
        fontWeight: 'bold',
        margin: config.styles.spacing.widget,
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: '0.2em',
        color: colors.foreground
      },
      '.latex-visual-section-1': { fontSize: '1.8em' },
      '.latex-visual-section-2': { fontSize: '1.5em' },
      '.latex-visual-section-3': { fontSize: '1.2em' },
      '.latex-visual-section-command': {
        display: 'block',
        margin: '20px 0 10px 0',
        padding: config.styles.spacing.container,
        backgroundColor: isDark ? colors.surface : `${colors.command}1a`,
        borderLeft: `4px solid ${colors.command}`,
        borderRadius: '4px',
        fontFamily: 'monospace',
        color: colors.foreground
      },
      '.latex-visual-math-inline': {
        background: 'none',
        border: 'none',
        margin: '0 1px',
        cursor: 'pointer',
        color: colors.math
      },
      '.latex-visual-math-display': {
        display: 'block',
        background: 'none',
        border: 'none',
        borderRadius: '4px',
        padding: config.styles.spacing.container,
        margin: config.styles.spacing.widget,
        textAlign: 'center',
        cursor: 'pointer',
        color: colors.math
      },
      '.latex-visual-environment': {
        display: 'block',
        margin: config.styles.spacing.widget,
        padding: config.styles.spacing.container,
        borderLeft: `3px solid ${colors.environment}`,
        backgroundColor: isDark ? colors.surface : `${colors.environment}0d`,
        color: colors.foreground
      },
      '.latex-visual-command': {
        display: 'inline',
        padding: '1px 2px',
        borderRadius: '2px',
        backgroundColor: isDark ? colors.surface : `${colors.command}1a`,
        color: colors.foreground
      },
      '.latex-visual-command.textbf': { fontWeight: 'bold' },
      '.latex-visual-command.textit': { fontStyle: 'italic' },
      '.latex-visual-command.underline': { textDecoration: 'underline' },
      '.latex-visual-command.textsc': { fontVariant: 'small-caps' },
      '.latex-visual-command.textsf': { fontFamily: 'sans-serif' },
      '.latex-visual-command.texttt': {
        fontFamily: 'monospace',
        backgroundColor: isDark ? colors.surface : 'rgba(0, 0, 0, 0.05)',
        borderRadius: '2px',
        padding: '1px 2px'
      },
      '.latex-command-raw': {
        display: 'inline-block',
        margin: '0 2px',
        padding: '2px 6px',
        backgroundColor: isDark ? colors.surface : `${colors.danger}1a`,
        border: `1px solid ${colors.danger}`,
        borderRadius: '3px',
        fontFamily: 'monospace',
        fontSize: '0.9em',
        color: colors.danger
      },
      '.latex-command-wrapper': {
        position: 'relative',
        display: 'inline',
        cursor: 'text',
        borderRadius: '2px',
        transition: 'background-color 0.2s ease',
        color: colors.foreground
      },
      '.latex-command-wrapper:focus': {
        backgroundColor: isDark ? `${colors.primary}20` : `${colors.primary}0d`,
        outline: 'none'
      },
      '.latex-command-wrapper:hover': {
        backgroundColor: isDark ? `${colors.primary}10` : `${colors.primary}08`
      },
      '.latex-visual-table': {
        display: 'block',
        margin: config.styles.spacing.widget,
        backgroundColor: colors.background,
        borderColor: colors.border
      },
      '.latex-table-cell': {
        backgroundColor: colors.background,
        borderColor: colors.border,
        color: colors.foreground
      },
      '.latex-visual-list': {
        color: colors.foreground
      }
    }, { dark: isDark });
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
      const newTheme = this.createTheme();
      this.cmEditor.dispatch({
        effects: this.themeCompartment.reconfigure(newTheme)
      });
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
      const newTheme = this.createTheme();
      this.cmEditor.dispatch({
        effects: [
          this.themeCompartment.reconfigure(newTheme),
          updateShowCommandsEffect.of(this.options.showCommands || false)
        ]
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
