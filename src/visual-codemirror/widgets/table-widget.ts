import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';

export class TableWidget extends BaseLatexWidget {
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

      const tableElement = this.createEditableTable(content, alignment, view, true);
      tableElement.style.margin = '5px 0';
      tableElement.style.border = '1px solid rgba(111, 66, 193, 0.2)';

      const endDiv = document.createElement('div');
      endDiv.className = 'table-end';
      endDiv.textContent = '\\end{tabular}';
      endDiv.style.color = '#6f42c1';
      endDiv.style.fontWeight = '600';
      endDiv.style.margin = '5px 0 0 0';
      endDiv.style.fontSize = '0.9em';

      wrapper.appendChild(beginDiv);
      wrapper.appendChild(tableElement);
      wrapper.appendChild(endDiv);

      return wrapper;
    }

    const table = this.createEditableTable(content, alignment, view, false);
    table.style.margin = '0';
    this.preserveLineHeight(table, this.token.latex);
    return table;
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

    rows.forEach((rowCells: string[], rowIndex: number) => {
      const tr = document.createElement('tr');

      rowCells.forEach((cellContent: string, colIndex: number) => {
        const td = document.createElement('td');
        td.className = 'latex-table-cell';
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px 12px';
        td.style.minWidth = '60px';
        td.contentEditable = 'true';
        td.style.outline = 'none';
        td.dataset.row = rowIndex.toString();
        td.dataset.col = colIndex.toString();

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

        td.textContent = cellContent;
        this.setupCellEvents(td, view, table, alignment);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }

  private parseTableRows(content: string, alignment: string): string[][] {
    if (!content.trim()) {
      const colCount = alignment.length || 2;
      return [Array(colCount).fill('')];
    }

    const rows = content.split('\\\\').map(row => row.trim());
    const colCount = alignment.length || 2;

    return rows.map(rowContent => {
      if (!rowContent) {
        return Array(colCount).fill('');
      }
      const cells = rowContent.split('&').map(cell => cell.trim());
      while (cells.length < colCount) {
        cells.push('');
      }
      return cells.slice(0, colCount);
    });
  }

  private setupCellEvents(cell: HTMLTableCellElement, view: EditorView, table: HTMLElement, alignment: string) {
    let updateTimeout: number;

    const scheduleUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = window.setTimeout(() => {
        this.updateTableContent(view, table, alignment);
      }, 300);
    };

    cell.addEventListener('input', () => {
      scheduleUpdate();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const nextCell = this.getNextCell(cell, !e.shiftKey);
        if (nextCell) {
          nextCell.focus();
          const range = document.createRange();
          const selection = window.getSelection();
          if (nextCell.firstChild) {
            range.setStart(nextCell.firstChild, 0);
            range.setEnd(nextCell.firstChild, nextCell.textContent?.length || 0);
          } else {
            range.selectNodeContents(nextCell);
          }
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const nextRow = this.getNextRowCell(cell);
        if (nextRow) {
          nextRow.focus();
        }
      }
    });

    cell.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    cell.addEventListener('click', (e) => {
      e.stopPropagation();
    });
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

  private updateTableContent(view: EditorView, table: HTMLElement, alignment: string) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const tableRows: string[] = [];

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const cellContents = cells.map(cell => (cell.textContent || ''));
      tableRows.push(cellContents.join(' & '));
    });

    const newContent = tableRows.join(' \\\\\n');
    const newLatex = `\\begin{tabular}{${alignment}}\n${newContent}\n\\end{tabular}`;

    this.updateTokenInEditor(view, newLatex);
  }
}