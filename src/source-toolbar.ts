import { EditorView } from '@codemirror/view';

export interface SourceToolbarOptions {
  showLatexCommands?: boolean;
}

export class SourceToolbar {
  private container: HTMLElement;
  private cmEditor: EditorView;
  private options: SourceToolbarOptions;

  constructor(container: HTMLElement, cmEditor: EditorView, options: SourceToolbarOptions = {}) {
    this.container = container;
    this.cmEditor = cmEditor;
    this.options = options;
    this.render();
  }

  private render() {
    this.container.innerHTML = `
      <div class="source-toolbar">
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
  }

  private attachEventListeners() {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-command]') as HTMLElement;

      if (btn) {
        const command = btn.dataset.command;
        if (command !== 'textcolor' && command !== 'colorbox') {
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

  updateOptions(options: SourceToolbarOptions) {
    this.options = { ...this.options, ...options };
  }
}