import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { LatexTokenizer } from '../../parsers/main-parser';
import { NestedContentRenderer } from '../nested-content-renderer';

interface CellData {
  content: string;
  hasWidgets: boolean;
}

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

        // Always use simple contentEditable for table cells to prevent focus issues
        td.contentEditable = 'true';
        td.textContent = cellData.content;

        this.setupCellEvents(td, view, table, alignment);
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

    return rows.map(rowContent => {
      if (!rowContent) {
        return Array(colCount).fill({content: '', hasWidgets: false});
      }

      const cells = rowContent.split('&').map(cell => {
        const trimmed = cell.trim();
        // For now, treat all cells as simple text to avoid focus issues
        return {content: trimmed, hasWidgets: false};
      });

      while (cells.length < colCount) {
        cells.push({content: '', hasWidgets: false});
      }
      return cells.slice(0, colCount);
    });
  }

  private setupCellEvents(cell: HTMLTableCellElement, view: EditorView, table: HTMLElement, alignment: string) {
    let updateTimeout: number;
    let isUpdating = false;

    const scheduleUpdate = () => {
      if (isUpdating) return;
      clearTimeout(updateTimeout);
      updateTimeout = window.setTimeout(() => {
        isUpdating = true;
        this.updateTableContent(view, table, alignment);
        setTimeout(() => { isUpdating = false; }, 100);
      }, 1000); // Much longer delay
    };

    cell.addEventListener('input', (e) => {
      e.stopPropagation();
      // Only schedule update, don't do it immediately
      scheduleUpdate();
    });

    cell.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Tab') {
        e.preventDefault();
        // Save immediately on tab
        clearTimeout(updateTimeout);
        this.updateTableContent(view, table, alignment);

        const nextCell = this.getNextCell(cell, !e.shiftKey);
        if (nextCell) {
          setTimeout(() => {
            nextCell.focus();
            const selection = window.getSelection();
            if (selection) {
              const range = document.createRange();
              range.selectNodeContents(nextCell);
              range.collapse(false); // Move cursor to end
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 50);
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Save immediately on enter
        clearTimeout(updateTimeout);
        this.updateTableContent(view, table, alignment);

        const nextRow = this.getNextRowCell(cell);
        if (nextRow) {
          setTimeout(() => {
            nextRow.focus();
          }, 50);
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

    // Only save on blur if user is actually leaving the table
    cell.addEventListener('blur', (e) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!relatedTarget || !table.contains(relatedTarget)) {
        clearTimeout(updateTimeout);
        this.updateTableContent(view, table, alignment);
      }
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
      const cellContents = cells.map(cell => (cell.textContent || '').trim());
      tableRows.push(cellContents.join(' & '));
    });

    const newContent = tableRows.join(' \\\\\n');
    const newLatex = `\\begin{tabular}{${alignment}}\n${newContent}\n\\end{tabular}`;

    this.updateTokenInEditor(view, newLatex);
  }
}