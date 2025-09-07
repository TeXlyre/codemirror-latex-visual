import { EditorView } from '@codemirror/view';
import { TableSelector, TableDimensions } from './components/table-selector';

export interface ToolbarOptions {
  currentMode?: 'source' | 'visual';
}

export class Toolbar {
  private container: HTMLElement;
  private cmEditor: EditorView;
  private options: ToolbarOptions;
  private tableSelector?: TableSelector;
  private currentMode: 'source' | 'visual' = 'source';

  constructor(container: HTMLElement, cmEditor: EditorView, options: ToolbarOptions = {}) {
    this.container = container;
    this.cmEditor = cmEditor;
    this.options = options;
    this.currentMode = options.currentMode || 'source';
    this.render();
  }

  private render() {
    this.container.innerHTML = `
      <div class="unified-toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" data-command="bold" title="Bold (\\textbf{})">
            <strong>B</strong>
          </button>
          <button class="toolbar-btn" data-command="italic" title="Italic (\\textit{})">
            <em>I</em>
          </button>
          <button class="toolbar-btn" data-command="underline" title="Underline (\\underline{})">
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
          <button class="toolbar-btn" data-command="itemize" title="Bullet List (\\begin{itemize})">
            <span>•</span>
          </button>
          <button class="toolbar-btn" data-command="enumerate" title="Numbered List (\\begin{enumerate})">
            <span>1.</span>
          </button>
          <button class="toolbar-btn" data-command="description" title="Description List (\\begin{description})">
            <span>⋮</span>
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
    const { state } = this.cmEditor;
    const { from, to } = state.selection.main;
    const selectedText = state.doc.sliceString(from, to);

    switch (command) {
      case 'bold':
        this.insertLatexCommand('textbf', selectedText);
        break;
      case 'italic':
        this.insertLatexCommand('textit', selectedText);
        break;
      case 'underline':
        this.insertLatexCommand('underline', selectedText);
        break;
      case 'math-inline':
        this.insertMath(false, selectedText);
        break;
      case 'math-display':
        this.insertMath(true, selectedText);
        break;
      case 'itemize':
        this.insertList('itemize');
        break;
      case 'enumerate':
        this.insertList('enumerate');
        break;
      case 'description':
        this.insertList('description');
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
        this.insertColorCommand('textcolor', colorInput.value, selectedText);
        break;
      case 'colorbox':
        const colorboxInput = element as HTMLInputElement;
        this.insertColorCommand('colorbox', colorboxInput.value, selectedText);
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

  private insertLatexCommand(cmdName: string, selectedText: string = '') {
    const { state } = this.cmEditor;
    const { from, to } = state.selection.main;

    const latexCommand = `\\${cmdName}{${selectedText}}`;
    const cursorPos = from + latexCommand.length - (selectedText ? selectedText.length + 1 : 1);

    const transaction = state.update({
      changes: { from, to, insert: latexCommand },
      selection: { anchor: cursorPos }
    });

    this.cmEditor.dispatch(transaction);
    this.cmEditor.focus();
  }

  private insertColorCommand(cmdType: string, color: string, selectedText: string = '') {
    const { state } = this.cmEditor;
    const { from, to } = state.selection.main;

    const latexCommand = `\\${cmdType}{${color}}{${selectedText}}`;
    const cursorPos = from + latexCommand.length - (selectedText ? selectedText.length + 1 : 1);

    const transaction = state.update({
      changes: { from, to, insert: latexCommand },
      selection: { anchor: cursorPos }
    });

    this.cmEditor.dispatch(transaction);
    this.cmEditor.focus();
  }

  private insertMath(displayMode: boolean, selectedText: string = '') {
    const { state } = this.cmEditor;
    const { from, to } = state.selection.main;

    const mathDelimiter = displayMode ? '$$' : '$';
    const mathCommand = `${mathDelimiter}${selectedText}${mathDelimiter}`;
    const cursorPos = from + mathDelimiter.length + (selectedText ? selectedText.length : 0);

    const transaction = state.update({
      changes: { from, to, insert: mathCommand },
      selection: { anchor: cursorPos }
    });

    this.cmEditor.dispatch(transaction);
    this.cmEditor.focus();
  }

  private insertList(listType: string) {
    const { state } = this.cmEditor;
    const { from, to } = state.selection.main;

    const itemContent = listType === 'description' ? '[term] description' : 'item content';
    const listLatex = `\\begin{${listType}}\n\\item ${itemContent}\n\\end{${listType}}`;
    const cursorPos = from + `\\begin{${listType}}\n\\item `.length;

    const transaction = state.update({
      changes: { from, to, insert: listLatex },
      selection: { anchor: cursorPos }
    });

    this.cmEditor.dispatch(transaction);
    this.cmEditor.focus();
  }

  private insertSection(sectionType: string) {
    const { state } = this.cmEditor;
    const { from, to } = state.selection.main;

    const latexCommand = `\\${sectionType}{}`;
    const cursorPos = from + latexCommand.length - 1;

    const transaction = state.update({
      changes: { from, to, insert: latexCommand },
      selection: { anchor: cursorPos }
    });

    this.cmEditor.dispatch(transaction);
    this.cmEditor.focus();
  }

  private insertTable(dimensions: TableDimensions) {
    const { state } = this.cmEditor;
    const { from, to } = state.selection.main;

    const alignment = 'l'.repeat(dimensions.cols);
    const emptyRow = Array(dimensions.cols).fill('').join(' & ');
    const rows = Array(dimensions.rows).fill(emptyRow).join(' \\\\\n');

    const tableLatex = `\\begin{tabular}{${alignment}}\n${rows}\n\\end{tabular}`;
    const cursorPos = from + `\\begin{tabular}{${alignment}}\n`.length;

    const transaction = state.update({
      changes: { from, to, insert: tableLatex },
      selection: { anchor: cursorPos }
    });

    this.cmEditor.dispatch(transaction);
    this.cmEditor.focus();
  }

  updateMode(mode: 'source' | 'visual') {
    this.currentMode = mode;
  }
}