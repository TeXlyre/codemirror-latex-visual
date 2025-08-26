import { EditorView, keymap } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { EditorView as PMView } from 'prosemirror-view';
import { EditorState as PMState } from 'prosemirror-state';
import { baseKeymap } from 'prosemirror-commands';
import { keymap as pmKeymap } from 'prosemirror-keymap';
import { SyncManager } from './sync-manager';
import { latexVisualSchema } from './prosemirror-schema';
import { parseLatexToProseMirror } from './latex-parser';

export interface DualEditorOptions {
  initialMode?: 'source' | 'visual';
  onModeChange?: (mode: 'source' | 'visual') => void;
  className?: string;
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

  constructor(container: HTMLElement, cmEditor: EditorView, options: DualEditorOptions = {}) {
    this.container = container;
    this.cmEditor = cmEditor;
    this.options = options;
    this.currentMode = options.initialMode || 'source';

    this.setupLayout();
    this.addCodeMirrorKeymap();
    this.createProseMirrorEditor();
    this.setupSyncManager();
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
    `;

    const editorsContainer = document.createElement('div');
    editorsContainer.className = 'latex-editors-container';

    const cmContainer = document.createElement('div');
    cmContainer.className = 'codemirror-container';

    const pmContainer = document.createElement('div');
    pmContainer.className = 'prosemirror-container';

    editorsContainer.appendChild(cmContainer);
    editorsContainer.appendChild(pmContainer);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(editorsContainer);

    this.container.appendChild(wrapper);

    cmContainer.appendChild(this.cmEditor.dom);

    this.pmContainer = pmContainer;
    this.toolbar = toolbar;

    toolbar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.mode-btn') as HTMLButtonElement;
      if (btn) {
        this.setMode(btn.dataset.mode as 'source' | 'visual');
      }
    });
  }

  private createProseMirrorEditor() {
    const toggleCommand = (state: any, dispatch: any) => {
      this.toggleMode();
      return true;
    };

    const pmState = PMState.create({
      schema: latexVisualSchema,
      doc: parseLatexToProseMirror(''),
      plugins: [
        pmKeymap({
          ...baseKeymap,
          'Ctrl-e': toggleCommand,
          'Cmd-e': toggleCommand
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
  }

  private setupSyncManager() {
    this.syncManager = new SyncManager(this.cmEditor, this.pmEditor);
  }

  public toggleMode() {
    const newMode = this.currentMode === 'source' ? 'visual' : 'source';
    this.setMode(newMode);
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
      this.pmEditor.focus();
    } else {
      this.syncManager.syncToSource();
      this.pmContainer.style.display = 'none';
      const parentElement = this.cmEditor.dom.parentElement;
      if (parentElement) {
        parentElement.style.display = 'block';
      }
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
    }
  ]);
}