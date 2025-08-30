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

      const tableElement = this.createVisualTable(content, alignment);
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

    return this.createVisualTable(content, alignment);
  }

  private createVisualTable(content: string, alignment: string): HTMLElement {
    const table = document.createElement('table');
    table.className = 'latex-visual-table';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '10px 0';
    table.style.width = '100%';
    table.style.border = '1px solid #ddd';

    const tbody = document.createElement('tbody');

    if (!content.trim()) {
      // Empty table
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.style.padding = '8px 12px';
      cell.style.border = '1px solid #ddd';
      cell.style.minWidth = '60px';
      cell.textContent = '';
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

        // Apply alignment based on column spec
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

        // Simple text content for now - could be enhanced to parse math/commands
        td.textContent = cellContent;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }
}