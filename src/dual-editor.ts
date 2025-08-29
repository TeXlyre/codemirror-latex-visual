import { EditorView, keymap } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { EditorView as PMView } from 'prosemirror-view';
import { EditorState as PMState } from 'prosemirror-state';
import { baseKeymap } from 'prosemirror-commands';
import { keymap as pmKeymap } from 'prosemirror-keymap';
import { SyncManager } from './sync-manager';
import { latexVisualSchema } from './prosemirror-schema';
import { parseLatexToProseMirror } from './latex-parser';
import { createLatexInputRules } from './prosemirror-input-rules';
import { VisualToolbar } from './visual-toolbar';

export interface DualEditorOptions {
  initialMode?: 'source' | 'visual';
  onModeChange?: (mode: 'source' | 'visual') => void;
  className?: string;
  showCommands?: boolean;
}

export class DualLatexEditor {
  private container: HTMLElement;
  private cmEditor: EditorView;
  private pmEditor!: PMView;
  private syncManager!: SyncManager;
  private currentMode: 'source' | 'visual';
  private options: DualEditorOptions;
  private pmContainer!: HTMLElement;
  private toolbar!: HTMLElement;
  private visualToolbar!: VisualToolbar;
  private visualToolbarContainer!: HTMLElement;
  private showCommands: boolean;

  constructor(container: HTMLElement, cmEditor: EditorView, options: DualEditorOptions = {}) {
    this.container = container;
    this.cmEditor = cmEditor;
    this.options = options;
    this.currentMode = options.initialMode || 'source';
    this.showCommands = options.showCommands || false;

    this.setupLayout();
    this.addCodeMirrorKeymap();
    this.createProseMirrorEditor();
    this.setupSyncManager();
    this.setMode(this.currentMode);
    this.updateCommandVisibility();
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
    `;

    const visualToolbarContainer = document.createElement('div');
    visualToolbarContainer.className = 'visual-toolbar-container';

    const editorsContainer = document.createElement('div');
    editorsContainer.className = 'latex-editors-container';

    const cmContainer = document.createElement('div');
    cmContainer.className = 'codemirror-container';

    const pmContainer = document.createElement('div');
    pmContainer.className = 'prosemirror-container';

    editorsContainer.appendChild(cmContainer);
    editorsContainer.appendChild(pmContainer);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(visualToolbarContainer);
    wrapper.appendChild(editorsContainer);

    this.container.appendChild(wrapper);

    cmContainer.appendChild(this.cmEditor.dom);

    this.pmContainer = pmContainer;
    this.toolbar = toolbar;
    this.visualToolbarContainer = visualToolbarContainer;

    toolbar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.mode-btn') as HTMLButtonElement;
      const cmdBtn = target.closest('.toggle-cmd-btn') as HTMLButtonElement;

      if (btn) {
        this.setMode(btn.dataset.mode as 'source' | 'visual');
      } else if (cmdBtn) {
        this.toggleCommandVisibility();
      }
    });

    setTimeout(() => {
      this.cmEditor.requestMeasure();
    }, 0);
  }

  private createProseMirrorEditor() {
    const toggleCommand = (state: any, dispatch: any) => {
      this.toggleMode();
      return true;
    };

    const toggleCommandsVisibility = (state: any, dispatch: any) => {
      this.toggleCommandVisibility();
      return true;
    };

    const pmState = PMState.create({
      schema: latexVisualSchema,
      doc: parseLatexToProseMirror(''),
      plugins: [
        createLatexInputRules(latexVisualSchema),
        pmKeymap({
          ...baseKeymap,
          'Ctrl-e': toggleCommand,
          'Cmd-e': toggleCommand,
          'Ctrl-Shift-c': toggleCommandsVisibility,
          'Cmd-Shift-c': toggleCommandsVisibility
        })
      ]
    });

    this.pmEditor = new PMView(this.pmContainer, {
      state: pmState,
      dispatchTransaction: (tr) => {
        const newState = this.pmEditor.state.apply(tr);
        this.pmEditor.updateState(newState);

        if (this.currentMode === 'visual' && tr.docChanged && !this.syncManager.syncing) {
          this.syncManager.handleProseMirrorChange(tr);
        }
      }
    });

    this.visualToolbar = new VisualToolbar(this.visualToolbarContainer, this.pmEditor);
  }

  private setupSyncManager() {
    this.syncManager = new SyncManager(this.cmEditor, this.pmEditor, this.showCommands);
  }

  public toggleMode() {
    const newMode = this.currentMode === 'source' ? 'visual' : 'source';
    this.setMode(newMode);
  }

  public toggleCommandVisibility() {
    this.showCommands = !this.showCommands;
    this.updateCommandVisibility();
    this.syncManager.updateCommandVisibility(this.showCommands);

    if (this.currentMode === 'visual') {
      this.syncManager.syncToVisualWithCommandToggle();
    }
  }

  private updateCommandVisibility() {
    (window as any).latexEditorShowCommands = this.showCommands;

    const cmdBtn = this.toolbar.querySelector('.toggle-cmd-btn') as HTMLButtonElement;
    if (cmdBtn) {
      cmdBtn.textContent = this.showCommands ? 'Hide LaTeX' : 'Show LaTeX';
      cmdBtn.classList.toggle('active', this.showCommands);
    }
  }

  setMode(mode: 'source' | 'visual') {
    if (mode === this.currentMode) return;

    if (mode === 'visual') {
      this.syncManager.syncToVisual();
      const parentElement = this.cmEditor.dom.parentElement;
      if (parentElement) {
        parentElement.style.display = 'none';
      }
      this.pmContainer.style.display = 'block';
      this.visualToolbarContainer.style.display = 'block';
      this.pmEditor.focus();
    } else {
      this.syncManager.syncToSource();
      this.pmContainer.style.display = 'none';
      this.visualToolbarContainer.style.display = 'none';
      const parentElement = this.cmEditor.dom.parentElement;
      if (parentElement) {
        parentElement.style.display = 'block';
      }
      this.cmEditor.requestMeasure();
      this.cmEditor.focus();
    }

    this.currentMode = mode;
    this.updateToolbar();
    this.options.onModeChange?.(mode);
  }

  private updateToolbar() {
    this.toolbar.querySelectorAll('.mode-btn').forEach((btn: Element) => {
      const button = btn as HTMLButtonElement;
      button.classList.toggle('active', button.dataset.mode === this.currentMode);
    });
  }

  destroy() {
    this.syncManager.destroy();
    this.pmEditor.destroy();
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
    }
  ]);
}