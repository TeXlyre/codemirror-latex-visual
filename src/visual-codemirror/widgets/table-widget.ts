import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';

export class TableWidget extends BaseLatexWidget {
  toDOM(view: EditorView): HTMLElement {
    const content = this.token.content || '';
    const alignment = this.token.params || '';

    if (this.showCommands) {
      const wrapper = document.createElement('div');
      wrapper.className = 'latex-table-command';
      wrapper.style.margin = '10px 0';
      wrapper.style.padding = '10px';
      wrapper.style.background = 'rgba(111, 66, 193, 0.1)';
      wrapper.style.border = '1px solid rgba(111, 66, 193, 0.3)';
      wrapper.style.borderRadius = '4px';
      wrapper.style.fontFamily = 'monospace';

      const beginDiv = document.createElement('div');
      beginDiv.className = 'table-begin';
      beginDiv.textContent = `\\begin{tabular}{${alignment}}`;
      beginDiv.style.color = '#6f42c1';
      beginDiv.style.fontWeight = '600';
      beginDiv.style.margin = '5px 0';
      beginDiv.style.fontSize = '0.9em';

      const tableElement = this.createEditableTable(content, alignment, view, true);
      tableElement.style.margin = '10px 0';
      tableElement.style.border = '1px solid rgba(111, 66, 193, 0.2)';

      const endDiv = document.createElement('div');
      endDiv.className = 'table-end';
      endDiv.textContent = '\\end{tabular}';
      endDiv.style.color = '#6f42c1';
      endDiv.style.fontWeight = '600';
      endDiv.style.margin = '5px 0';
      endDiv.style.fontSize = '0.9em';

      wrapper.appendChild(beginDiv);
      wrapper.appendChild(tableElement);
      wrapper.appendChild(endDiv);

      return wrapper;
    }

    return this.createEditableTable(content, alignment, view, false);
  }

  private createEditableTable(content: string, alignment: string, view: EditorView, showCommands: boolean): HTMLElement {
    const table = document.createElement('table');
    table.className = 'latex-visual-table';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '10px 0';
    table.style.width = '100%';
    table.style.border = '1px solid #ddd';

    const tbody = document.createElement('tbody');

    if (!content.trim()) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.style.padding = '8px 12px';
      cell.style.border = '1px solid #ddd';
      cell.style.minWidth = '60px';
      cell.contentEditable = 'true';
      cell.style.outline = 'none';
      cell.textContent = '';

      cell.addEventListener('blur', () => {
        this.updateTableContent(view, table, alignment);
      });

      row.appendChild(cell);
      tbody.appendChild(row);
      table.appendChild(tbody);
      return table;
    }

    const rows = content.split('\\\\').map(row => row.trim()).filter(row => row);

    rows.forEach((rowContent: string) => {
      const tr = document.createElement('tr');
      const cells = rowContent.split('&').map(cell => cell.trim());

      cells.forEach((cellContent: string, index: number) => {
        const td = document.createElement('td');
        td.className = 'latex-table-cell';
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px 12px';
        td.style.minWidth = '60px';
        td.contentEditable = 'true';
        td.style.outline = 'none';

        const align = alignment.charAt(index) || 'l';
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

        td.addEventListener('blur', () => {
          this.updateTableContent(view, table, alignment);
        });

        td.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const nextCell = this.getNextCell(td, !e.shiftKey);
            if (nextCell) {
              nextCell.focus();
            }
          }
        });

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
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

  private updateTableContent(view: EditorView, table: HTMLElement, alignment: string) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const tableRows: string[] = [];

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const cellContents = cells.map(cell => (cell.textContent || '').trim());
      if (cellContents.some(content => content)) {
        tableRows.push(cellContents.join(' & '));
      }
    });

    const newContent = tableRows.join(' \\\\\n');
    const newLatex = `\\begin{tabular}{${alignment}}\n${newContent}\n\\end{tabular}`;

    this.updateTokenInEditor(view, newLatex);
  }
}