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
  private lastFocusedWidget?: HTMLElement;

  constructor(container: HTMLElement, cmEditor: EditorView, options: ToolbarOptions = {}) {
    this.container = container;
    this.cmEditor = cmEditor;
    this.options = options;
    this.currentMode = options.currentMode || 'source';
    this.render();
    this.setupWidgetFocusTracking();
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

  private setupWidgetFocusTracking() {
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      const widget = target.closest('.latex-visual-widget, .latex-command-wrapper, [contenteditable="true"]');
      if (widget && widget !== this.cmEditor.dom) {
        this.lastFocusedWidget = widget as HTMLElement;
      }
    });

    document.addEventListener('focusout', (e) => {
      setTimeout(() => {
        const activeElement = document.activeElement;
        if (!activeElement || !activeElement.closest('.latex-visual-widget, .latex-command-wrapper, [contenteditable="true"]')) {
          this.lastFocusedWidget = undefined;
        }
      }, 100);
    });
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
      if (target.dataset.command === 'textcolor' || target.dataset.command === 'colorbox') {
        this.executeCommand(target.dataset.command, target);
      } else if (target.dataset.command) {
        this.executeCommand(target.dataset.command, target);
      }
    });
  }

  private executeCommand(command: string, element: HTMLElement) {
    if (this.lastFocusedWidget && this.currentMode === 'visual') {
      this.executeCommandOnWidget(command, element);
    } else {
      this.executeCommandOnEditor(command, element);
    }
  }

  private executeCommandOnWidget(command: string, element: HTMLElement) {
    if (!this.lastFocusedWidget) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';

    if (this.lastFocusedWidget.classList.contains('latex-command-wrapper')) {
      this.wrapWidgetContent(this.lastFocusedWidget, command, element, selectedText);
    } else if (this.lastFocusedWidget.contentEditable === 'true') {
      this.insertIntoEditableElement(this.lastFocusedWidget, command, element, selectedText);
    } else {
      const editableChild = this.lastFocusedWidget.querySelector('[contenteditable="true"]') as HTMLElement;
      if (editableChild) {
        this.insertIntoEditableElement(editableChild, command, element, selectedText);
      }
    }
  }

  private wrapWidgetContent(widget: HTMLElement, command: string, element: HTMLElement, selectedText: string) {
    const visualSpan = widget.querySelector('.latex-visual-command') as HTMLElement;
    if (!visualSpan) return;

    const currentContent = visualSpan.textContent || '';

    let wrappedContent = '';
    if (selectedText && currentContent.includes(selectedText)) {
      wrappedContent = currentContent.replace(selectedText, this.getLatexWrapper(command, element, selectedText));
    } else {
      wrappedContent = this.getLatexWrapper(command, element, currentContent);
    }

    visualSpan.innerHTML = '';
    visualSpan.textContent = wrappedContent;

    this.triggerWidgetUpdate(widget);
  }

  private insertIntoEditableElement(editableElement: HTMLElement, command: string, element: HTMLElement, selectedText: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (!editableElement.contains(range.commonAncestorContainer)) {
      if (selectedText) {
        editableElement.textContent = (editableElement.textContent || '') + this.getLatexWrapper(command, element, selectedText);
      } else {
        const latex = this.getLatexWrapper(command, element, '');
        editableElement.textContent = (editableElement.textContent || '') + latex;
      }
    } else {
      const textToWrap = selectedText || '';
      const latex = this.getLatexWrapper(command, element, textToWrap);

      range.deleteContents();
      const textNode = document.createTextNode(latex);
      range.insertNode(textNode);

      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.triggerElementUpdate(editableElement);
  }

  private getLatexWrapper(command: string, element: HTMLElement, content: string): string {
    switch (command) {
      case 'bold':
        return `\\textbf{${content}}`;
      case 'italic':
        return `\\textit{${content}}`;
      case 'underline':
        return `\\underline{${content}}`;
      case 'math-inline':
        return `$${content}$`;
      case 'math-display':
        return `$$${content}$$`;
      case 'textcolor':
        const colorInput = element as HTMLInputElement;
        return `\\textcolor{${colorInput.value}}{${content}}`;
      case 'colorbox':
        const colorboxInput = element as HTMLInputElement;
        return `\\colorbox{${colorboxInput.value}}{${content}}`;
      default:
        return content;
    }
  }

  private triggerWidgetUpdate(widget: HTMLElement) {
    const inputEvent = new Event('input', { bubbles: true });
    widget.dispatchEvent(inputEvent);

    const blurEvent = new Event('blur', { bubbles: true });
    widget.dispatchEvent(blurEvent);
  }

  private triggerElementUpdate(element: HTMLElement) {
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);

    const blurEvent = new Event('blur', { bubbles: true });
    element.dispatchEvent(blurEvent);
  }

  private executeCommandOnEditor(command: string, element: HTMLElement) {
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