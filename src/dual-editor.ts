import { EditorView, keymap } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { VisualCodeMirrorEditor } from './visual-codemirror/visual-editor';
import { VisualToolbar } from './visual-toolbar';
import { SourceToolbar } from './source-toolbar';

export interface DualEditorOptions {
  initialMode?: 'source' | 'visual';
  onModeChange?: (mode: 'source' | 'visual') => void;
  className?: string;
  showCommands?: boolean;
  showToolbar?: boolean;
}

export class DualLatexEditor {
  private container: HTMLElement;
  private cmEditor: EditorView;
  private visualEditor!: VisualCodeMirrorEditor;
  private currentMode: 'source' | 'visual';
  private options: DualEditorOptions;
  private toolbar!: HTMLElement;
  private visualToolbar!: VisualToolbar;
  private sourceToolbar!: SourceToolbar;
  private visualToolbarContainer!: HTMLElement;
  private sourceToolbarContainer!: HTMLElement;
  private showCommands: boolean;
  private showToolbar: boolean;

  constructor(container: HTMLElement, cmEditor: EditorView, options: DualEditorOptions = {}) {
    this.container = container;
    this.cmEditor = cmEditor;
    this.options = options;
    this.currentMode = options.initialMode || 'source';
    this.showCommands = options.showCommands || false;
    this.showToolbar = options.showToolbar !== false;

    this.setupLayout();
    this.addCodeMirrorKeymap();
    this.createVisualEditor();
    this.setMode(this.currentMode);
  }

  private addCodeMirrorKeymap() {
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

  private setupLayout() {
    const wrapper = document.createElement('div');
    wrapper.className = `latex-dual-editor ${this.options.className || ''}`;

    const toolbar = document.createElement('div');
    toolbar.className = 'latex-editor-toolbar';
    toolbar.innerHTML = `
      <button class="mode-btn" data-mode="source">LaTeX Source</button>
      <button class="mode-btn" data-mode="visual">Visual</button>
      <button class="toggle-cmd-btn" title="Toggle Command Visibility (Ctrl+Shift+C)">Show Commands</button>
      <button class="toggle-toolbar-btn" title="Toggle Toolbar (Ctrl+Shift+T)">Hide Toolbar</button>
    `;

    const visualToolbarContainer = document.createElement('div');
    visualToolbarContainer.className = 'visual-toolbar-container';

    const sourceToolbarContainer = document.createElement('div');
    sourceToolbarContainer.className = 'source-toolbar-container';

    const editorsContainer = document.createElement('div');
    editorsContainer.className = 'latex-editors-container';

    const cmContainer = document.createElement('div');
    cmContainer.className = 'codemirror-container';

    editorsContainer.appendChild(cmContainer);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(visualToolbarContainer);
    wrapper.appendChild(sourceToolbarContainer);
    wrapper.appendChild(editorsContainer);

    this.container.appendChild(wrapper);
    cmContainer.appendChild(this.cmEditor.dom);

    this.toolbar = toolbar;
    this.visualToolbarContainer = visualToolbarContainer;
    this.sourceToolbarContainer = sourceToolbarContainer;

    toolbar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.mode-btn') as HTMLButtonElement;
      const cmdBtn = target.closest('.toggle-cmd-btn') as HTMLButtonElement;
      const toolbarBtn = target.closest('.toggle-toolbar-btn') as HTMLButtonElement;

      if (btn) {
        this.setMode(btn.dataset.mode as 'source' | 'visual');
      } else if (cmdBtn) {
        this.toggleCommandVisibility();
      } else if (toolbarBtn) {
        this.toggleToolbar();
      }
    });

    setTimeout(() => {
      this.cmEditor.requestMeasure();
    }, 0);
  }

  private createVisualEditor() {
    this.visualEditor = new VisualCodeMirrorEditor(this.cmEditor, {
      showCommands: this.showCommands,
      onModeChange: (mode) => {
        this.currentMode = mode;
        this.updateToolbar();
        this.updateToolbarVisibility();
        this.options.onModeChange?.(mode);
      }
    });

    this.visualToolbar = new VisualToolbar(this.visualToolbarContainer, this.cmEditor);
    this.sourceToolbar = new SourceToolbar(this.sourceToolbarContainer, this.cmEditor);
  }

  public toggleMode() {
    const newMode = this.currentMode === 'source' ? 'visual' : 'source';
    this.setMode(newMode);
  }

  public toggleCommandVisibility() {
    this.showCommands = !this.showCommands;
    this.updateCommandVisibility();
    this.visualEditor.updateOptions({ showCommands: this.showCommands });
  }

  public toggleToolbar() {
    this.showToolbar = !this.showToolbar;
    this.updateToolbarVisibility();
  }

  private updateCommandVisibility() {
    (window as any).latexEditorShowCommands = this.showCommands;

    const cmdBtn = this.toolbar.querySelector('.toggle-cmd-btn') as HTMLButtonElement;
    if (cmdBtn) {
      cmdBtn.textContent = this.showCommands ? 'Hide LaTeX' : 'Show LaTeX';
      cmdBtn.classList.toggle('active', this.showCommands);
    }
  }

  private updateToolbarVisibility() {
    const toolbarBtn = this.toolbar.querySelector('.toggle-toolbar-btn') as HTMLButtonElement;
    if (toolbarBtn) {
      toolbarBtn.textContent = this.showToolbar ? 'Hide Toolbar' : 'Show Toolbar';
      toolbarBtn.classList.toggle('active', !this.showToolbar);
    }

    this.visualToolbarContainer.style.display = this.showToolbar && this.currentMode === 'visual' ? 'block' : 'none';
    this.sourceToolbarContainer.style.display = this.showToolbar && this.currentMode === 'source' ? 'block' : 'none';
  }

  setMode(mode: 'source' | 'visual') {
    if (mode === this.currentMode) return;

    this.currentMode = mode;
    this.visualEditor.setVisualMode(mode === 'visual');
    this.updateToolbar();
    this.updateToolbarVisibility();
    this.options.onModeChange?.(mode);
  }

  private updateToolbar() {
    this.toolbar.querySelectorAll('.mode-btn').forEach((btn: Element) => {
      const button = btn as HTMLButtonElement;
      button.classList.toggle('active', button.dataset.mode === this.currentMode);
    });
  }

  destroy() {
    this.visualEditor.destroy();
  }
}

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
      key: 'Ctrl-Shift-t',
      mac: 'Cmd-Shift-t',
      run: () => {
        dualEditor.toggleToolbar();
        return true;
      }
    }
  ]);
}