// src/dual-editor.ts
import { EditorView, keymap } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { VisualCodeMirrorEditor } from './visual-codemirror/visual-editor';
import { Toolbar } from './toolbar';
import { ConfigService, DEFAULT_CONFIG, LatexEditorConfig, DARK_THEME_COLORS, LIGHT_THEME_COLORS } from './core/config';
import { EventService } from './core/event-service';
import { FocusService } from './core/focus-service';
import { DOMUtils } from './core/dom-utils';
import { WidgetRegistry } from './core/widget-registry';
import { errorService, ErrorCategory, ErrorSeverity } from './core/error-service';
import { MathHoverManager, createMathHoverExtension } from './visual-codemirror/widgets/math-hover-widget';

export interface DualEditorOptions {
  initialMode?: 'source' | 'visual';
  onModeChange?: (mode: 'source' | 'visual') => void;
  className?: string;
  showCommands?: boolean;
  showToolbar?: boolean;
  enableMathHover?: boolean;
  theme?: 'light' | 'dark';
  config?: Partial<LatexEditorConfig>;
}

export class DualLatexEditor {
  private container: HTMLElement;
  private cmEditor: EditorView;
  private visualEditor!: VisualCodeMirrorEditor;
  private currentMode: 'source' | 'visual';
  private options: DualEditorOptions;

  // Core services
  private configService: ConfigService;
  private eventService: EventService;
  private focusService: FocusService;
  private domUtils: DOMUtils;
  private widgetRegistry: WidgetRegistry;

  // UI components
  private toolbar!: HTMLElement;
  private unifiedToolbar!: Toolbar;
  private toolbarContainer!: HTMLElement;

  // Math hover functionality
  private mathHoverManager?: MathHoverManager;

  // Cleanup functions
  private cleanupFunctions: Array<() => void> = [];

  constructor(container: HTMLElement, cmEditor: EditorView, options: DualEditorOptions = {}) {
    this.container = container;
    this.cmEditor = cmEditor;
    this.options = options;
    this.currentMode = options.initialMode || 'source';

    // Initialize services
    const initialTheme = options.theme || 'light';
    const themeColors = initialTheme === 'dark' ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
    
    this.configService = new ConfigService({
      ...DEFAULT_CONFIG,
      ...options.config,
      theme: initialTheme,
      showCommands: options.showCommands ?? DEFAULT_CONFIG.showCommands,
      showToolbar: options.showToolbar ?? DEFAULT_CONFIG.showToolbar,
      styles: {
        ...DEFAULT_CONFIG.styles,
        ...options.config?.styles,
        colors: {
          ...themeColors,
          ...options.config?.styles?.colors
        }
      }
    });

    this.eventService = EventService.getInstance();
    this.focusService = new FocusService(this.eventService);
    this.domUtils = new DOMUtils(this.configService.get());
    this.widgetRegistry = new WidgetRegistry(this.eventService, this.cmEditor);

    this.initialize();
  }

  private initialize(): void {
    try {
      this.setupEventListeners();
      this.setupLayout();
      this.addCodeMirrorKeymap();
      this.setupMathHover();
      this.createVisualEditor();
      this.setMode(this.currentMode);
      this.applyTheme();

      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.INFO,
        'DualLatexEditor initialized successfully',
        { mode: this.currentMode, options: this.options }
      );
    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.FATAL,
        'Failed to initialize DualLatexEditor',
        { error, options: this.options }
      );
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen for config changes
    const configUnsubscribe = this.configService.subscribe((config) => {
      this.domUtils = new DOMUtils(config);
      this.updateFromConfig(config);
      this.applyTheme();
      if (this.visualEditor) {
        this.visualEditor.updateOptions({ config });
      }
      if (this.unifiedToolbar && typeof (this.unifiedToolbar as any).updateTheme === 'function') {
        (this.unifiedToolbar as any).updateTheme(config.theme);
      }
    });

    // Listen for mode changes
    const modeUnsubscribe = this.eventService.onModeChange((event) => {
      if (event.triggeredBy === 'api') {
        this.updateToolbar();
        this.updateToolbarVisibility();
      }
    });

    this.cleanupFunctions.push(configUnsubscribe, modeUnsubscribe);
  }

  private setupMathHover(): void {
    try {
      // Add math hover extension to CodeMirror
      this.cmEditor.dispatch({
        effects: StateEffect.appendConfig.of(createMathHoverExtension())
      });

      // Create math hover manager
      this.mathHoverManager = new MathHoverManager(this.cmEditor);

      // Set initial state based on options
      const enableMathHover = this.options.enableMathHover ?? true;
      this.mathHoverManager.setEnabled(enableMathHover && this.currentMode === 'source');

    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.ERROR,
        'Failed to setup math hover functionality',
        { error }
      );
    }
  }

  private setupLayout(): void {
    const config = this.configService.get();

    const wrapper = this.domUtils.createElement('div', {
      className: `latex-dual-editor theme-${config.theme} ${this.options.className || ''}`,
      styles: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: `1px solid ${config.styles.colors.border}`,
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: config.styles.colors.background,
        color: config.styles.colors.foreground
      }
    });

    this.toolbar = this.createToolbar(config);
    this.toolbarContainer = this.createToolbarContainer();
    const editorsContainer = this.createEditorsContainer();

    const cmContainer = this.domUtils.createElement('div', {
      className: 'codemirror-container',
      styles: {
        flex: '1',
        minHeight: '0'
      }
    });

    editorsContainer.appendChild(cmContainer);
    wrapper.appendChild(this.toolbar);
    wrapper.appendChild(this.toolbarContainer);
    wrapper.appendChild(editorsContainer);

    this.container.appendChild(wrapper);
    cmContainer.appendChild(this.cmEditor.dom);

    this.setupToolbarEvents();

    setTimeout(() => {
      this.cmEditor.requestMeasure();
    }, 0);
  }

  private createToolbar(config: LatexEditorConfig): HTMLElement {
    const toolbar = this.domUtils.createElement('div', {
      className: 'latex-editor-toolbar',
      styles: {
        display: 'flex',
        backgroundColor: config.styles.colors.surface,
        borderBottom: `1px solid ${config.styles.colors.border}`,
        padding: config.styles.spacing.container,
        gap: '8px',
        flexShrink: '0'
      }
    });

    const modeSourceBtn = this.domUtils.createButton(
      'LaTeX Source',
      () => this.setMode('source'),
      {
        className: 'mode-btn',
        attributes: { 'data-mode': 'source' },
        styles: {
          backgroundColor: config.styles.colors.background,
          color: config.styles.colors.foreground,
          borderColor: config.styles.colors.border
        }
      }
    );

    const modeVisualBtn = this.domUtils.createButton(
      'Visual',
      () => this.setMode('visual'),
      {
        className: 'mode-btn',
        attributes: { 'data-mode': 'visual' },
        styles: {
          backgroundColor: config.styles.colors.background,
          color: config.styles.colors.foreground,
          borderColor: config.styles.colors.border
        }
      }
    );

    const toggleCmdBtn = this.domUtils.createButton(
      'Show Commands',
      () => this.toggleCommandVisibility(),
      {
        className: 'toggle-cmd-btn',
        attributes: { title: 'Toggle Command Visibility (Ctrl+Shift+C)' },
        styles: {
          backgroundColor: config.styles.colors.background,
          color: config.styles.colors.foreground,
          borderColor: config.styles.colors.border
        }
      }
    );

    const toggleMathHoverBtn = this.domUtils.createButton(
      'Math Hover',
      () => this.toggleMathHover(),
      {
        className: 'toggle-math-hover-btn',
        attributes: { title: 'Toggle Math Hover Preview (Ctrl+Shift+M)' },
        styles: {
          backgroundColor: config.styles.colors.background,
          color: config.styles.colors.foreground,
          borderColor: config.styles.colors.border
        }
      }
    );

    const toggleToolbarBtn = this.domUtils.createButton(
      'Hide Toolbar',
      () => this.toggleToolbar(),
      {
        className: 'toggle-toolbar-btn',
        attributes: { title: 'Toggle Toolbar (Ctrl+Shift+T)' },
        styles: {
          backgroundColor: config.styles.colors.background,
          color: config.styles.colors.foreground,
          borderColor: config.styles.colors.border
        }
      }
    );

    toolbar.appendChild(modeSourceBtn);
    toolbar.appendChild(modeVisualBtn);
    toolbar.appendChild(toggleCmdBtn);
    toolbar.appendChild(toggleMathHoverBtn);
    toolbar.appendChild(toggleToolbarBtn);

    return toolbar;
  }

  private createToolbarContainer(): HTMLElement {
    const config = this.configService.get();
    return this.domUtils.createElement('div', {
      className: 'unified-toolbar-container',
      styles: {
        display: 'none',
        borderBottom: `1px solid ${config.styles.colors.border}`,
        flexShrink: '0',
        backgroundColor: config.styles.colors.surface
      }
    });
  }

  private createEditorsContainer(): HTMLElement {
    return this.domUtils.createElement('div', {
      className: 'latex-editors-container',
      styles: {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0'
      }
    });
  }

  private setupToolbarEvents(): void {
    // Events are handled by individual button click handlers
    // This keeps the event handling centralized and type-safe
  }

  private addCodeMirrorKeymap(): void {
    const toggleKeymap = keymap.of([
      {
        key: 'Ctrl-e',
        mac: 'Cmd-e',
        run: () => {
          this.toggleMode();
          return true;
        }
      },
      {
        key: 'Ctrl-Shift-c',
        mac: 'Cmd-Shift-c',
        run: () => {
          this.toggleCommandVisibility();
          return true;
        }
      },
      {
        key: 'Ctrl-Shift-m',
        mac: 'Cmd-Shift-m',
        run: () => {
          this.toggleMathHover();
          return true;
        }
      },
      {
        key: 'Ctrl-Shift-t',
        mac: 'Cmd-Shift-t',
        run: () => {
          this.toggleToolbar();
          return true;
        }
      }
    ]);

    this.cmEditor.dispatch({
      effects: StateEffect.appendConfig.of(toggleKeymap)
    });
  }

  private createVisualEditor(): void {
    const config = this.configService.get();

    this.visualEditor = new VisualCodeMirrorEditor(this.cmEditor, {
      showCommands: config.showCommands,
      config: config,
      onModeChange: (mode) => {
        this.currentMode = mode;
        this.updateToolbar();
        this.updateToolbarVisibility();
        this.unifiedToolbar.updateMode(mode);

        // Update math hover state
        if (this.mathHoverManager) {
          const enableMathHover = this.options.enableMathHover ?? true;
          this.mathHoverManager.setEnabled(enableMathHover && mode === 'source');
          this.updateMathHoverButtonState();
        }

        this.eventService.emitModeChange({
          oldMode: this.currentMode === 'source' ? 'visual' : 'source',
          newMode: mode,
          triggeredBy: 'user'
        });

        this.options.onModeChange?.(mode);
      }
    });

    this.unifiedToolbar = new Toolbar(this.toolbarContainer, this.cmEditor, {
      currentMode: this.currentMode,
      theme: config.theme
    });

    // Initialize toolbar button states
    this.updateMathHoverButtonState();
  }

  // Public API methods
  public toggleMode(): void {
    const newMode = this.currentMode === 'source' ? 'visual' : 'source';
    this.setMode(newMode);
  }

  public toggleCommandVisibility(): void {
    const config = this.configService.get();
    const newShowCommands = !config.showCommands;

    this.configService.update({ showCommands: newShowCommands });
    this.visualEditor.updateOptions({ showCommands: newShowCommands });
    this.updateCommandVisibilityUI(newShowCommands);
  }

  public toggleMathHover(): void {
    if (!this.mathHoverManager) return;

    const currentState = this.mathHoverManager.getEnabled();
    const newState = !currentState;

    // Only allow math hover in source mode
    if (this.currentMode === 'source') {
      this.mathHoverManager.setEnabled(newState);
      this.options.enableMathHover = newState;
    } else {
      // If in visual mode, just update the option for when we switch back
      this.options.enableMathHover = newState;
    }

    this.updateMathHoverButtonState();
  }

  public toggleToolbar(): void {
    const config = this.configService.get();
    const newShowToolbar = !config.showToolbar;

    this.configService.update({ showToolbar: newShowToolbar });
    this.updateToolbarVisibility();
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.configService.setTheme(theme);
    this.options.theme = theme;
  }

  public setMode(mode: 'source' | 'visual'): void {
    if (mode === this.currentMode) return;

    try {
      // Store current cursor position
      const currentSelection = this.cmEditor.state.selection.main;

      this.currentMode = mode;
      this.visualEditor.setVisualMode(mode === 'visual');
      this.updateToolbar();
      this.updateToolbarVisibility();
      this.unifiedToolbar.updateMode(mode);

      // Update math hover based on mode
      if (this.mathHoverManager) {
        const enableMathHover = this.options.enableMathHover ?? true;
        this.mathHoverManager.setEnabled(enableMathHover && mode === 'source');
        this.updateMathHoverButtonState();
      }

      // Restore cursor position
      setTimeout(() => {
        this.cmEditor.dispatch({
          selection: { anchor: currentSelection.from, head: currentSelection.to }
        });
        this.cmEditor.focus();
      }, this.configService.get().defaultTimeouts.focus);

      this.eventService.emitModeChange({
        oldMode: mode === 'source' ? 'visual' : 'source',
        newMode: mode,
        triggeredBy: 'api'
      });

      this.options.onModeChange?.(mode);
    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.ERROR,
        `Failed to set mode to ${mode}`,
        { mode, currentMode: this.currentMode, error }
      );
    }
  }

  private applyTheme(): void {
    const config = this.configService.get();
    const wrapper = this.container.querySelector('.latex-dual-editor') as HTMLElement;
    
    if (wrapper) {
      // Update theme class
      wrapper.classList.remove('theme-light', 'theme-dark');
      wrapper.classList.add(`theme-${config.theme}`);
      
      // Update wrapper styles
      wrapper.style.backgroundColor = config.styles.colors.background;
      wrapper.style.color = config.styles.colors.foreground;
      wrapper.style.borderColor = config.styles.colors.border;
      
      // Update CSS custom properties for consistent theming
      this.setCSSProperties(config);
      this.updateMathLiveTheme(config);
      
      // Update toolbar styles
      this.updateToolbarStyles(config);
    }
  }

  private setCSSProperties(config: LatexEditorConfig): void {
    const root = document.documentElement;
    const colors = config.styles.colors;
    
    root.style.setProperty('--latex-bg', colors.background);
    root.style.setProperty('--latex-fg', colors.foreground);
    root.style.setProperty('--latex-surface', colors.surface);
    root.style.setProperty('--latex-border', colors.border);
    root.style.setProperty('--latex-primary', colors.primary);
    root.style.setProperty('--latex-secondary', colors.secondary);
    root.style.setProperty('--latex-success', colors.success);
    root.style.setProperty('--latex-warning', colors.warning);
    root.style.setProperty('--latex-danger', colors.danger);
    root.style.setProperty('--latex-math', colors.math);
    root.style.setProperty('--latex-environment', colors.environment);
    root.style.setProperty('--latex-command', colors.command);
    root.style.setProperty('--latex-table', colors.table);
  }

  private updateMathLiveTheme(config: LatexEditorConfig): void {
    const root = document.documentElement;
    const colors = config.styles.colors;
    const isDark = config.theme === 'dark';
    
    // Set MathLive CSS custom properties
    root.style.setProperty('--ml-color', colors.foreground);
    root.style.setProperty('--ml-background', colors.background);
    root.style.setProperty('--ml-accent', colors.primary);
    
    if (isDark) {
      root.style.setProperty('--ml-highlight', '#4da6ff');
      root.style.setProperty('--ml-primary', '#4da6ff');
      root.style.setProperty('--ml-text', '#f9fafb');
      root.style.setProperty('--ml-surface', '#374151');
    } else {
      root.style.setProperty('--ml-highlight', '#007acc');
      root.style.setProperty('--ml-primary', '#007acc');
      root.style.setProperty('--ml-text', '#000000');
      root.style.setProperty('--ml-surface', '#f8f9fa');
    }
  }

  private updateToolbarStyles(config: LatexEditorConfig): void {
    if (this.toolbar) {
      this.toolbar.style.backgroundColor = config.styles.colors.surface;
      this.toolbar.style.borderBottomColor = config.styles.colors.border;
      
      // Update all toolbar buttons
      const buttons = this.toolbar.querySelectorAll('.mode-btn, .toggle-cmd-btn, .toggle-math-hover-btn, .toggle-toolbar-btn');
      buttons.forEach((button: Element) => {
        const btn = button as HTMLElement;
        if (!btn.classList.contains('active')) {
          btn.style.backgroundColor = config.styles.colors.background;
          btn.style.color = config.styles.colors.foreground;
          btn.style.borderColor = config.styles.colors.border;
        }
      });
    }

    if (this.toolbarContainer) {
      this.toolbarContainer.style.backgroundColor = config.styles.colors.surface;
      this.toolbarContainer.style.borderBottomColor = config.styles.colors.border;
    }
  }

  public getConfig(): LatexEditorConfig {
    return this.configService.get();
  }

  public updateConfig(updates: Partial<LatexEditorConfig>): void {
    this.configService.update(updates);
  }

  public getWidgetRegistry(): WidgetRegistry {
    return this.widgetRegistry;
  }

  public isMathHoverEnabled(): boolean {
    return this.mathHoverManager?.getEnabled() ?? false;
  }

  public destroy(): void {
    try {
      this.cleanupFunctions.forEach(cleanup => cleanup());
      this.visualEditor.destroy();
      this.focusService.cleanup();
      this.widgetRegistry.cleanup();
      this.eventService.removeAllListeners();
      
      // Cleanup math hover
      if (this.mathHoverManager) {
        this.mathHoverManager.destroy();
      }

      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.INFO,
        'DualLatexEditor destroyed successfully'
      );
    } catch (error) {
      errorService.logError(
        ErrorCategory.STATE,
        ErrorSeverity.ERROR,
        'Error during DualLatexEditor destruction',
        { error }
      );
    }
  }

  // Private helper methods
  private updateFromConfig(config: LatexEditorConfig): void {
    this.updateCommandVisibilityUI(config.showCommands);
    this.updateToolbarVisibility();
  }

  private updateCommandVisibilityUI(showCommands: boolean): void {
    const cmdBtn = this.toolbar.querySelector('.toggle-cmd-btn') as HTMLButtonElement;
    if (cmdBtn) {
      cmdBtn.textContent = showCommands ? 'Hide LaTeX' : 'Show LaTeX';
      cmdBtn.classList.toggle('active', showCommands);
      
      const config = this.configService.get();
      if (showCommands) {
        cmdBtn.style.backgroundColor = config.styles.colors.success;
        cmdBtn.style.borderColor = config.styles.colors.success;
        cmdBtn.style.color = 'white';
      } else {
        cmdBtn.style.backgroundColor = config.styles.colors.background;
        cmdBtn.style.borderColor = config.styles.colors.border;
        cmdBtn.style.color = config.styles.colors.foreground;
      }
    }
  }

  private updateMathHoverButtonState(): void {
    const mathHoverBtn = this.toolbar.querySelector('.toggle-math-hover-btn') as HTMLButtonElement;
    if (!mathHoverBtn || !this.mathHoverManager) return;

    const config = this.configService.get();
    const isEnabled = this.options.enableMathHover ?? true;
    const isActive = this.mathHoverManager.getEnabled();
    
    mathHoverBtn.textContent = isEnabled ? 'Math Hover: On' : 'Math Hover: Off';
    mathHoverBtn.classList.toggle('active', isEnabled);
    
    // Disable button in visual mode
    mathHoverBtn.disabled = this.currentMode === 'visual';
    if (this.currentMode === 'visual') {
      mathHoverBtn.title = 'Math Hover (only available in source mode)';
      mathHoverBtn.style.backgroundColor = config.styles.colors.secondary;
      mathHoverBtn.style.color = 'white';
    } else {
      mathHoverBtn.title = 'Toggle Math Hover Preview (Ctrl+Shift+M)';
      if (isEnabled) {
        mathHoverBtn.style.backgroundColor = config.styles.colors.success;
        mathHoverBtn.style.borderColor = config.styles.colors.success;
        mathHoverBtn.style.color = 'white';
      } else {
        mathHoverBtn.style.backgroundColor = config.styles.colors.background;
        mathHoverBtn.style.borderColor = config.styles.colors.border;
        mathHoverBtn.style.color = config.styles.colors.foreground;
      }
    }
  }

  private updateToolbarVisibility(): void {
    const config = this.configService.get();
    const toolbarBtn = this.toolbar.querySelector('.toggle-toolbar-btn') as HTMLButtonElement;

    if (toolbarBtn) {
      toolbarBtn.textContent = config.showToolbar ? 'Hide Toolbar' : 'Show Toolbar';
      toolbarBtn.classList.toggle('active', !config.showToolbar);
      
      if (!config.showToolbar) {
        toolbarBtn.style.backgroundColor = config.styles.colors.warning;
        toolbarBtn.style.borderColor = config.styles.colors.warning;
        toolbarBtn.style.color = 'white';
      } else {
        toolbarBtn.style.backgroundColor = config.styles.colors.background;
        toolbarBtn.style.borderColor = config.styles.colors.border;
        toolbarBtn.style.color = config.styles.colors.foreground;
      }
    }

    this.toolbarContainer.style.display = config.showToolbar ? 'block' : 'none';
  }

  private updateToolbar(): void {
    const config = this.configService.get();
    
    this.toolbar.querySelectorAll('.mode-btn').forEach((btn: Element) => {
      const button = btn as HTMLButtonElement;
      const isActive = button.dataset.mode === this.currentMode;
      button.classList.toggle('active', isActive);
      
      if (isActive) {
        button.style.backgroundColor = config.styles.colors.primary;
        button.style.borderColor = config.styles.colors.primary;
        button.style.color = 'white';
      } else {
        button.style.backgroundColor = config.styles.colors.background;
        button.style.borderColor = config.styles.colors.border;
        button.style.color = config.styles.colors.foreground;
      }
    });

    // Update math hover button state when mode changes
    this.updateMathHoverButtonState();
  }
}

// Export the keymap function for backward compatibility
export function latexVisualKeymap(dualEditor: DualLatexEditor) {
  return keymap.of([
    {
      key: 'Ctrl-e',
      mac: 'Cmd-e',
      run: () => {
        dualEditor.toggleMode();
        return true;
      }
    },
    {
      key: 'Ctrl-Shift-c',
      mac: 'Cmd-Shift-c',
      run: () => {
        dualEditor.toggleCommandVisibility();
        return true;
      }
    },
    {
      key: 'Ctrl-Shift-m',
      mac: 'Cmd-Shift-m',
      run: () => {
        dualEditor.toggleMathHover();
        return true;
      }
    },
    {
      key: 'Ctrl-Shift-t',
      mac: 'Cmd-Shift-t',
      run: () => {
        dualEditor.toggleToolbar();
        return true;
      }
    }
  ]);
}
