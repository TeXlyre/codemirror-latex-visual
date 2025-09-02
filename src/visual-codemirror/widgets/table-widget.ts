import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { LatexTokenizer } from '../../parsers/main-parser';
import { NestedContentRenderer } from '../nested-content-renderer';

interface CellData {
  content: string;
  hasWidgets: boolean;
}

export class TableWidget extends BaseLatexWidget {
  private tableElement?: HTMLElement;

  toDOM(view: EditorView): HTMLElement {
    const content = this.token.content || '';
    const alignment = this.token.params || '';

    if (this.showCommands) {
      const wrapper = document.createElement('div');
      wrapper.className = 'latex-table-command';
      wrapper.style.margin = '0';
      wrapper.style.padding = '10px';
      wrapper.style.background = 'rgba(111, 66, 193, 0.1)';
      wrapper.style.border = '1px solid rgba(111, 66, 193, 0.3)';
      wrapper.style.borderRadius = '4px';
      wrapper.style.fontFamily = 'monospace';
      wrapper.style.lineHeight = '1.4';

      this.preserveLineHeight(wrapper, this.token.latex);

      const beginDiv = document.createElement('div');
      beginDiv.className = 'table-begin';
      beginDiv.textContent = `\\begin{tabular}{${alignment}}`;
      beginDiv.style.color = '#6f42c1';
      beginDiv.style.fontWeight = '600';
      beginDiv.style.margin = '0 0 5px 0';
      beginDiv.style.fontSize = '0.9em';

      this.tableElement = this.createEditableTable(content, alignment, view, true);
      this.tableElement.style.margin = '5px 0';
      this.tableElement.style.border = '1px solid rgba(111, 66, 193, 0.2)';

      const endDiv = document.createElement('div');
      endDiv.className = 'table-end';
      endDiv.textContent = '\\end{tabular}';
      endDiv.style.color = '#6f42c1';
      endDiv.style.fontWeight = '600';
      endDiv.style.margin = '5px 0 0 0';
      endDiv.style.fontSize = '0.9em';

      wrapper.appendChild(beginDiv);
      wrapper.appendChild(this.tableElement);
      wrapper.appendChild(endDiv);

      return wrapper;
    }

    this.tableElement = this.createEditableTable(content, alignment, view, false);
    this.tableElement.style.margin = '0';
    this.preserveLineHeight(this.tableElement, this.token.latex);
    return this.tableElement;
  }

  private createEditableTable(content: string, alignment: string, view: EditorView, showCommands: boolean): HTMLElement {
    const table = document.createElement('table');
    table.className = 'latex-visual-table';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '10px 0';
    table.style.width = '100%';
    table.style.border = '1px solid #ddd';

    const tbody = document.createElement('tbody');

    const rows = this.parseTableRows(content, alignment);

    rows.forEach((rowCells: CellData[], rowIndex: number) => {
      const tr = document.createElement('tr');

      rowCells.forEach((cellData: CellData, colIndex: number) => {
        const td = document.createElement('td');
        td.className = 'latex-table-cell';
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px 12px';
        td.style.minWidth = '60px';
        td.style.outline = 'none';
        td.dataset.row = rowIndex.toString();
        td.dataset.col = colIndex.toString();
        td.dataset.originalContent = cellData.content;

        const align = alignment.charAt(colIndex) || 'l';
        switch (align) {
          case 'c':
            td.style.textAlign = 'center';
            break;
          case 'r':
            td.style.textAlign = 'right';
            break;
          default:
            td.style.textAlign = 'left';
        }

        if (cellData.hasWidgets) {
          td.contentEditable = 'false';
          const contentDiv = document.createElement('div');
          contentDiv.contentEditable = 'true';
          contentDiv.style.outline = 'none';
          contentDiv.style.minHeight = '1.2em';

          NestedContentRenderer.renderNestedContent(contentDiv, cellData.content, view, this.showCommands);
          td.appendChild(contentDiv);

          this.setupNestedCellEvents(contentDiv, td, view, table, alignment);
        } else {
          td.contentEditable = 'true';
          td.textContent = cellData.content;
          this.setupSimpleCellEvents(td, view, table, alignment);
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }

  private parseTableRows(content: string, alignment: string): CellData[][] {
    if (!content.trim()) {
      const colCount = alignment.length || 2;
      return [Array(colCount).fill({content: '', hasWidgets: false})];
    }

    const rows = content.split('\\\\').map(row => row.trim());
    const colCount = alignment.length || 2;
    const tokenizer = new LatexTokenizer();

    return rows.map(rowContent => {
      if (!rowContent) {
        return Array(colCount).fill({content: '', hasWidgets: false});
      }

      const cells = rowContent.split('&').map(cell => {
        const trimmed = cell.trim();
        const tokens = tokenizer.tokenize(trimmed);
        const hasWidgets = tokens.some(token =>
          token.type !== 'text' && token.type !== 'paragraph_break'
        );
        return {content: trimmed, hasWidgets};
      });

      while (cells.length < colCount) {
        cells.push({content: '', hasWidgets: false});
      }
      return cells.slice(0, colCount);
    });
  }

  private setupSimpleCellEvents(cell: HTMLTableCellElement, view: EditorView, table: HTMLElement, alignment: string) {
    cell.addEventListener('input', (e) => {
      e.stopPropagation();
      this.updateTable(view, table, alignment);
    });

    cell.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        this.updateTable(view, table, alignment);
        const nextCell = this.getNextCell(cell, !e.shiftKey);
        if (nextCell) {
          setTimeout(() => this.focusCell(nextCell), 10);
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.updateTable(view, table, alignment);
        const nextRow = this.getNextRowCell(cell);
        if (nextRow) {
          setTimeout(() => this.focusCell(nextRow), 10);
        }
      }
    });

    cell.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    cell.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    cell.addEventListener('focus', (e) => {
      e.stopPropagation();
    });

    cell.addEventListener('blur', () => {
      this.updateTable(view, table, alignment);
    });
  }

  private setupNestedCellEvents(contentDiv: HTMLElement, cell: HTMLTableCellElement, view: EditorView, table: HTMLElement, alignment: string) {
    contentDiv.addEventListener('input', (e) => {
      e.stopPropagation();
      this.updateTable(view, table, alignment);
    });

    contentDiv.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        this.updateTable(view, table, alignment);
        const nextCell = this.getNextCell(cell, !e.shiftKey);
        if (nextCell) {
          setTimeout(() => this.focusCell(nextCell), 10);
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.updateTable(view, table, alignment);
        const nextRow = this.getNextRowCell(cell);
        if (nextRow) {
          setTimeout(() => this.focusCell(nextRow), 10);
        }
      }
    });

    contentDiv.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    contentDiv.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    contentDiv.addEventListener('focus', (e) => {
      e.stopPropagation();
    });

    contentDiv.addEventListener('blur', () => {
      this.updateTable(view, table, alignment);
    });
  }

  private handleCellNavigation(e: KeyboardEvent, cell: HTMLTableCellElement, view: EditorView, table: HTMLElement, alignment: string) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCell = this.getNextCell(cell, !e.shiftKey);
      if (nextCell) {
        setTimeout(() => this.focusCell(nextCell), 10);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const nextRow = this.getNextRowCell(cell);
      if (nextRow) {
        setTimeout(() => this.focusCell(nextRow), 10);
      }
    }
  }

  private focusCell(cell: HTMLTableCellElement) {
    requestAnimationFrame(() => {
      const editableElement = cell.contentEditable === 'true' ? cell : cell.querySelector('[contenteditable="true"]') as HTMLElement;
      if (editableElement) {
        editableElement.focus();

        if (editableElement.textContent) {
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(editableElement);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    });
  }

  private updateTable(view: EditorView, table: HTMLElement, alignment: string) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const tableRows: string[] = [];

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const cellContents = cells.map(cell => {
        if (cell.contentEditable === 'true') {
          return (cell.textContent || '').trim();
        } else {
          const editableDiv = cell.querySelector('[contenteditable="true"]');
          if (editableDiv) {
            return NestedContentRenderer.extractContentFromContainer(editableDiv as HTMLElement);
          }
        }
        return cell.dataset.originalContent || '';
      });
      tableRows.push(cellContents.join(' & '));
    });

    const newContent = tableRows.join(' \\\\\n');
    const newLatex = `\\begin{tabular}{${alignment}}\n${newContent}\n\\end{tabular}`;
    this.updateTokenInEditor(view, newLatex);
  }

  private getNextCell(currentCell: HTMLTableCellElement, forward: boolean): HTMLTableCellElement | null {
    const table = currentCell.closest('table');
    if (!table) return null;

    const cells = Array.from(table.querySelectorAll('td')) as HTMLTableCellElement[];
    const currentIndex = cells.indexOf(currentCell);

    if (forward && currentIndex < cells.length - 1) {
      return cells[currentIndex + 1];
    } else if (!forward && currentIndex > 0) {
      return cells[currentIndex - 1];
    }

    return null;
  }

  private getNextRowCell(currentCell: HTMLTableCellElement): HTMLTableCellElement | null {
    const table = currentCell.closest('table');
    if (!table) return null;

    const currentRow = currentCell.parentElement;
    const nextRow = currentRow?.nextElementSibling;

    if (nextRow) {
      const colIndex = Array.from(currentRow.children).indexOf(currentCell);
      return nextRow.children[colIndex] as HTMLTableCellElement;
    }

    return null;
  }
}