import { EditorView } from 'prosemirror-view';
import { Selection } from 'prosemirror-state';
import { toggleMark, wrapIn, setBlockType } from 'prosemirror-commands';
import { latexVisualSchema } from './prosemirror-schema';
import { TableSelector, TableDimensions } from './components/table-selector';

export interface ToolbarOptions {
  showLatexCommands?: boolean;
}

export class VisualToolbar {
  private container: HTMLElement;
  private pmEditor: EditorView;
  private options: ToolbarOptions;
  private tableSelector?: TableSelector;

  constructor(container: HTMLElement, pmEditor: EditorView, options: ToolbarOptions = {}) {
    this.container = container;
    this.pmEditor = pmEditor;
    this.options = options;
    this.render();
  }

  private render() {
    this.container.innerHTML = `
      <div class="visual-toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" data-command="bold" title="Bold (\\textbf)">
            <strong>B</strong>
          </button>
          <button class="toolbar-btn" data-command="italic" title="Italic (\\textit)">
            <em>I</em>
          </button>
          <button class="toolbar-btn" data-command="underline" title="Underline (\\underline)">
            <u>U</u>
          </button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" data-command="math-inline" title="Inline Math ($...$)">
            <span>∫</span>
          </button>
          <button class="toolbar-btn" data-command="math-display" title="Display Math ($$...$$)">
            <span>∬</span>
          </button>
        </div>
        <div class="toolbar-group">
          <div class="toolbar-table-container">
            <button class="toolbar-btn" data-command="table" title="Insert Table">
              <span>⊞</span>
            </button>
            <div class="table-selector-dropdown"></div>
          </div>
        </div>
        <div class="toolbar-group">
          <select class="toolbar-select" data-command="section">
            <option value="">Heading</option>
            <option value="section">Section</option>
            <option value="subsection">Subsection</option>
            <option value="subsubsection">Subsubsection</option>
          </select>
        </div>
        <div class="toolbar-group">
          <input type="color" class="toolbar-color" data-command="textcolor" title="Text Color (\\textcolor)" value="#000000">
          <input type="color" class="toolbar-color" data-command="colorbox" title="Background Color (\\colorbox)" value="#ffff00">
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.setupTableSelector();
  }

  private setupTableSelector() {
    const dropdown = this.container.querySelector('.table-selector-dropdown') as HTMLElement;
    if (dropdown) {
      this.tableSelector = new TableSelector(dropdown, (dimensions) => {
        this.insertTable(dimensions);
      });
    }
  }

  private attachEventListeners() {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-command]') as HTMLElement;

      if (btn) {
        const command = btn.dataset.command;
        if (command === 'table') {
          e.preventDefault();
          this.toggleTableSelector();
        } else if (command !== 'textcolor' && command !== 'colorbox') {
          e.preventDefault();
          this.executeCommand(command!, btn);
        }
      }
    });

    this.container.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.command) {
        this.executeCommand(target.dataset.command, target);
      }
    });

    this.container.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.command === 'textcolor' || target.dataset.command === 'colorbox') {
        this.executeCommand(target.dataset.command, target);
      }
    });
  }

  private executeCommand(command: string, element: HTMLElement) {
    const { state, dispatch } = this.pmEditor;
    const showCommands = (window as any).latexEditorShowCommands || false;

    switch (command) {
      case 'bold':
        this.insertCommand('textbf');
        break;
      case 'italic':
        this.insertCommand('textit');
        break;
      case 'underline':
        this.insertCommand('underline');
        break;
      case 'math-inline':
        this.insertMath(false);
        break;
      case 'math-display':
        this.insertMath(true);
        break;
      case 'section':
        const select = element as HTMLSelectElement;
        if (select.value) {
          this.insertSection(select.value);
          select.value = '';
        }
        break;
      case 'textcolor':
        const colorInput = element as HTMLInputElement;
        this.insertColorCommand('textcolor', colorInput.value);
        break;
      case 'colorbox':
        const colorboxInput = element as HTMLInputElement;
        this.insertColorCommand('colorbox', colorboxInput.value);
        break;
    }
  }

  private toggleTableSelector() {
    if (!this.tableSelector) return;

    const dropdown = this.container.querySelector('.table-selector-dropdown') as HTMLElement;
    if (!dropdown) return;

    const computedStyle = window.getComputedStyle(dropdown);
    const isVisible = dropdown.style.display === 'block' ||
                     (dropdown.style.display !== 'none' && computedStyle.display === 'block');

    if (isVisible) {
      this.tableSelector.hide();
    } else {
      this.tableSelector.show();
    }
  }

  private insertCommand(cmdName: string) {
    const { state, dispatch } = this.pmEditor;
    const { from, to } = state.selection;
    const showCommands = (window as any).latexEditorShowCommands || false;

    const selectedText = state.doc.textBetween(from, to);

    const node = latexVisualSchema.nodes.editable_command.create({
      name: cmdName,
      latex: `\\${cmdName}{${selectedText}}`,
      showCommands
    }, selectedText ? [latexVisualSchema.text(selectedText)] : []);

    const tr = state.tr.replaceWith(from, to, node);

    if (!selectedText) {
      tr.setSelection(Selection.near(tr.doc.resolve(from + 1)));
    }

    dispatch(tr);
    this.pmEditor.focus();
  }

  private insertColorCommand(cmdType: string, color: string) {
    const { state, dispatch } = this.pmEditor;
    const { from, to } = state.selection;
    const showCommands = (window as any).latexEditorShowCommands || false;

    const selectedText = state.doc.textBetween(from, to);

    const node = latexVisualSchema.nodes.editable_command.create({
      name: cmdType,
      latex: `\\${cmdType}{${color}}{${selectedText}}`,
      showCommands,
      colorArg: color
    }, selectedText ? [latexVisualSchema.text(selectedText)] : []);

    const tr = state.tr.replaceWith(from, to, node);

    if (!selectedText) {
      tr.setSelection(Selection.near(tr.doc.resolve(from + 1)));
    }

    dispatch(tr);
    this.pmEditor.focus();
  }

  private insertMath(displayMode: boolean) {
    const { state, dispatch } = this.pmEditor;
    const { from } = state.selection;

    const nodeType = displayMode ?
      latexVisualSchema.nodes.math_display :
      latexVisualSchema.nodes.math_inline;

    const node = nodeType.create({
      latex: '',
      rendered: ''
    });

    const tr = state.tr.insert(from, node);
    dispatch(tr);
    this.pmEditor.focus();
  }

  private insertSection(sectionType: string) {
    const { state, dispatch } = this.pmEditor;
    const { from } = state.selection;
    const showCommands = (window as any).latexEditorShowCommands || false;

    const level = sectionType === 'section' ? 1 :
                  sectionType === 'subsection' ? 2 : 3;

    const node = latexVisualSchema.nodes.section.create({
      level,
      latex: `\\${sectionType}{}`,
      name: sectionType,
      showCommands
    }, []);

    const tr = state.tr.insert(from, node);
    tr.setSelection(Selection.near(tr.doc.resolve(from + 1)));
    dispatch(tr);
    this.pmEditor.focus();
  }

  private insertTable(dimensions: TableDimensions) {
    const { state, dispatch } = this.pmEditor;
    const { from } = state.selection;
    const showCommands = (window as any).latexEditorShowCommands || false;

    const alignment = 'l'.repeat(dimensions.cols);
    const rows: any[] = [];

    for (let r = 0; r < dimensions.rows; r++) {
      const cells: any[] = [];
      for (let c = 0; c < dimensions.cols; c++) {
        cells.push(
          latexVisualSchema.nodes.table_cell.create({ alignment: 'l' }, [])
        );
      }
      rows.push(latexVisualSchema.nodes.table_row.create({}, cells));
    }

    const tableLatex = `\\begin{tabular}{${alignment}}\n${Array(dimensions.rows).fill(Array(dimensions.cols).fill('').join(' & ')).join(' \\\\\n')}\n\\end{tabular}`;

    const node = latexVisualSchema.nodes.table.create({
      alignment,
      latex: tableLatex,
      showCommands
    }, rows);

    const tr = state.tr.insert(from, node);
    dispatch(tr);
    this.pmEditor.focus();
  }

  updateOptions(options: ToolbarOptions) {
    this.options = { ...this.options, ...options };
  }
}