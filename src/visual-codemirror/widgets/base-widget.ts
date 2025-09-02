import { WidgetType, EditorView } from '@codemirror/view';
import { LatexToken } from '../../parsers/base-parser';
import { LatexTokenizer } from '../../parsers/main-parser';

export abstract class BaseLatexWidget extends WidgetType {
  protected token: LatexToken;
  protected showCommands: boolean;

  constructor(token: LatexToken, showCommands: boolean = false) {
    super();
    this.token = token;
    this.showCommands = showCommands || (window as any).latexEditorShowCommands || false;
  }

  eq(other: WidgetType): boolean {
    return other instanceof BaseLatexWidget &&
           other.token.latex === this.token.latex &&
           other.showCommands === this.showCommands;
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    const newElement = this.toDOM(view);
    dom.replaceWith(newElement);
    return true;
  }

  abstract toDOM(view: EditorView): HTMLElement;

  ignoreEvent(event: Event): boolean {
    if (event.type === 'mousedown' || event.type === 'click') {
      const target = event.target as HTMLElement;
      if (target.closest('.latex-visual-widget, .latex-visual-section, .latex-visual-math-inline, .latex-visual-math-display, .latex-visual-environment, .latex-visual-command, .latex-visual-table')) {
        return false;
      }
      return true;
    }
    return false;
  }

  protected preserveLineHeight(element: HTMLElement, originalText: string) {
    const newlineCount = (originalText.match(/\n/g) || []).length;
    if (newlineCount > 0) {
      element.style.minHeight = `${(newlineCount + 1) * 1.4}em`;
    }
  }

  protected makeEditable(element: HTMLElement, view: EditorView, onUpdate: (newContent: string) => void) {
    element.contentEditable = 'true';
    element.style.outline = 'none';
    element.style.cursor = 'text';
    element.style.userSelect = 'text';
    element.style.webkitUserSelect = 'text';

    element.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        element.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        element.blur();
      }
    });

    element.addEventListener('input', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('blur', () => {
      const newContent = element.textContent || '';
      onUpdate(newContent);
    });

    element.addEventListener('focus', (e) => {
      e.stopPropagation();
    });

    return element;
  }

  protected makeEditableWithNestedWidgets(
    element: HTMLElement,
    view: EditorView,
    originalContent: string,
    onLatexGenerate: (extractedContent: string) => string,
    onUpdate?: () => void
  ) {
    element.contentEditable = 'true';
    element.style.outline = 'none';
    element.style.cursor = 'text';
    element.style.userSelect = 'text';
    element.style.webkitUserSelect = 'text';

    let isUpdating = false;

    const handleContentUpdate = () => {
      if (isUpdating) return;
      isUpdating = true;

      const extractedContent = this.extractLatexFromElement(element);

      if (extractedContent !== originalContent) {
        const newLatex = onLatexGenerate(extractedContent);

        this.updateTokenInEditor(view, newLatex);

        setTimeout(() => {
          const nestedTokens = this.parseContent(extractedContent);
          if (nestedTokens.length > 1 || (nestedTokens.length === 1 && nestedTokens[0].type !== 'text')) {
            element.innerHTML = '';
            this.renderChildren(element, nestedTokens, view);

            this.makeEditableWithNestedWidgets(element, view, extractedContent, onLatexGenerate, onUpdate);
          }

          if (onUpdate) onUpdate();
          isUpdating = false;
        }, 100);
      } else {
        isUpdating = false;
      }
    };

    element.addEventListener('blur', handleContentUpdate);

    element.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        element.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        element.blur();
      }
    });

    element.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('input', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('focus', (e) => {
      e.stopPropagation();
    });
  }

  protected extractLatexFromElement(element: HTMLElement): string {
    let result = '';

    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;

        if (el.classList.contains('latex-visual-math-inline')) {
          const mathfield = el.querySelector('math-field');
          if (mathfield && (mathfield as any).getValue) {
            try {
              const latex = (mathfield as any).getValue('latex');
              result += `$${latex}$`;
              continue;
            } catch (e) {
              console.warn('Error extracting math latex:', e);
            }
          }
          result += `$${this.extractTextFromMathWidget(el)}$`;

        } else if (el.classList.contains('latex-visual-math-display')) {
          const mathfield = el.querySelector('math-field');
          if (mathfield && (mathfield as any).getValue) {
            try {
              const latex = (mathfield as any).getValue('latex');
              result += `$$${latex}$$`;
              continue;
            } catch (e) {
              console.warn('Error extracting math latex:', e);
            }
          }
          result += `$$${this.extractTextFromMathWidget(el)}$$`;

        } else if (el.classList.contains('latex-visual-command')) {
          const cmdName = this.extractCommandName(el);
          const cmdContent = this.extractLatexFromElement(el);

          if (cmdName === 'textcolor' || cmdName === 'colorbox') {
            const colorArg = el.dataset.colorArg || 'black';
            result += `\\${cmdName}{${colorArg}}{${cmdContent}}`;
          } else if (cmdName) {
            result += `\\${cmdName}{${cmdContent}}`;
          } else {
            result += cmdContent;
          }

        } else if (el.classList.contains('latex-visual-environment')) {
          const envName = this.extractEnvironmentName(el);
          const envContent = this.extractLatexFromElement(el.querySelector('.env-content') || el);
          result += `\\begin{${envName}}\n${envContent}\n\\end{${envName}}`;

        } else if (el.classList.contains('latex-visual-table')) {
          result += this.extractTableLatex(el);

        } else if (el.classList.contains('latex-visual-section')) {
          const sectionName = this.extractSectionName(el);
          const sectionContent = el.textContent || '';
          result += `\\${sectionName}{${sectionContent}}`;

        } else {
          result += this.extractLatexFromElement(el);
        }
      }
    }

    return result;
  }

  private extractTextFromMathWidget(element: HTMLElement): string {
    if (element.dataset.mathLatex) {
      return element.dataset.mathLatex;
    }
    return element.textContent?.replace(/✏️/g, '').trim() || '';
  }

  private extractCommandName(element: HTMLElement): string {
    const classList = Array.from(element.classList);
    for (const cls of classList) {
      if (cls !== 'latex-visual-command' && cls !== 'latex-visual-widget') {
        return cls;
      }
    }
    return element.dataset.cmdName || '';
  }

  private extractEnvironmentName(element: HTMLElement): string {
    const classList = Array.from(element.classList);
    for (const cls of classList) {
      if (cls.startsWith('latex-env-')) {
        return cls.replace('latex-env-', '');
      }
    }
    const header = element.querySelector('.env-header');
    return header?.textContent?.toLowerCase() || 'unknown';
  }

  private extractSectionName(element: HTMLElement): string {
    if (element.classList.contains('latex-visual-section-1')) return 'section';
    if (element.classList.contains('latex-visual-section-2')) return 'subsection';
    if (element.classList.contains('latex-visual-section-3')) return 'subsubsection';
    return 'section';
  }

  private extractTableLatex(element: HTMLElement): string {
    const table = element.tagName === 'TABLE' ? element : element.querySelector('table');
    if (!table) return '';

    const rows = Array.from(table.querySelectorAll('tr'));
    const tableRows: string[] = [];
    let colCount = 0;

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      colCount = Math.max(colCount, cells.length);
      const cellContents = cells.map(cell => this.extractLatexFromElement(cell as HTMLElement));
      tableRows.push(cellContents.join(' & '));
    });

    const alignment = 'l'.repeat(colCount);
    const content = tableRows.join(' \\\\\n');

    return `\\begin{tabular}{${alignment}}\n${content}\n\\end{tabular}`;
  }

  protected findTokenInDocument(view: EditorView) {
    const doc = view.state.doc;
    const text = doc.toString();
    const index = text.indexOf(this.token.latex);

    if (index === -1) return null;

    return {
      from: index,
      to: index + this.token.latex.length
    };
  }

  protected updateTokenInEditor(view: EditorView, newLatex: string) {
    const pos = this.findTokenInDocument(view);
    if (pos === null) return;

    const { from, to } = pos;
    view.dispatch({
      changes: { from, to, insert: newLatex }
    });
  }

  protected createNestedWidget(token: LatexToken, view: EditorView): HTMLElement | Text {
    if (token.type === 'text') {
      return document.createTextNode(token.content);
    }

    const widget = this.createWidgetInstance(token);
    if (widget) {
      return widget.toDOM(view);
    }

    return document.createTextNode(token.latex);
  }

  private createWidgetInstance(token: LatexToken): BaseLatexWidget | null {
    switch (token.type) {
      case 'section':
        const SectionWidget = this.getSectionWidget();
        return new SectionWidget(token, this.showCommands);

      case 'math_inline':
        const MathInlineWidget = this.getMathWidget();
        return new MathInlineWidget(token, false);

      case 'math_display':
        const MathDisplayWidget = this.getMathWidget();
        return new MathDisplayWidget(token, true);

      case 'environment':
        if (token.name === 'tabular') {
          const TableWidget = this.getTableWidget();
          return new TableWidget(token, this.showCommands);
        } else {
          const EnvironmentWidget = this.getEnvironmentWidget();
          return new EnvironmentWidget(token, this.showCommands);
        }

      case 'editable_command':
      case 'command':
        const CommandWidget = this.getCommandWidget();
        return new CommandWidget(token, this.showCommands);

      default:
        return null;
    }
  }

  private getSectionWidget(): any {
    return (window as any).LatexWidgets?.SectionWidget ||
           (() => { throw new Error('SectionWidget not available'); });
  }

  private getMathWidget(): any {
    return (window as any).LatexWidgets?.MathWidget ||
           (() => { throw new Error('MathWidget not available'); });
  }

  private getEnvironmentWidget(): any {
    return (window as any).LatexWidgets?.EnvironmentWidget ||
           (() => { throw new Error('EnvironmentWidget not available'); });
  }

  private getTableWidget(): any {
    return (window as any).LatexWidgets?.TableWidget ||
           (() => { throw new Error('TableWidget not available'); });
  }

  private getCommandWidget(): any {
    return (window as any).LatexWidgets?.CommandWidget ||
           (() => { throw new Error('CommandWidget not available'); });
  }

  protected renderChildren(container: HTMLElement, children: LatexToken[], view: EditorView) {
    children.forEach(child => {
      const element = this.createNestedWidget(child, view);
      container.appendChild(element);
    });
  }

  protected parseContent(content: string): LatexToken[] {
    if (!content.trim()) return [];

    const tokenizer = new LatexTokenizer();
    return tokenizer.tokenize(content);
  }
}