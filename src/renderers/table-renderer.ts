import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class TableRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'table' || node.type.name === 'table_row' || node.type.name === 'table_cell';
  }

  render(node: PMNode): string {
    if (node.type.name === 'table') {
      const alignment = node.attrs.alignment || '';
      const rows: string[] = [];

      node.content.forEach((rowNode: PMNode) => {
        if (rowNode.type.name === 'table_row') {
          const cells: string[] = [];
          rowNode.content.forEach((cellNode: PMNode) => {
            if (cellNode.type.name === 'table_cell') {
              cells.push(this.renderCellContent(cellNode));
            }
          });
          rows.push(cells.join(' & '));
        }
      });

      const tableContent = rows.join(' \\\\\n');
      return `\\begin{tabular}{${alignment}}\n${tableContent}\n\\end{tabular}`;
    }

    return '';
  }

  private renderCellContent(cellNode: PMNode): string {
    const parts: string[] = [];

    cellNode.descendants((child, pos) => {
      if (child === cellNode) return true;

      switch (child.type.name) {
        case 'text':
          if (child.text) parts.push(child.text);
          return false;
        case 'math_inline':
          parts.push(`$${child.attrs.latex}$`);
          return false;
        case 'editable_command':
          const cmdName = child.attrs.name;
          if ((cmdName === 'textcolor' || cmdName === 'colorbox') && child.attrs.colorArg) {
            const innerContent = this.renderCellContent(child);
            parts.push(`\\${cmdName}{${child.attrs.colorArg}}{${innerContent}}`);
          } else {
            const innerContent = this.renderCellContent(child);
            parts.push(`\\${cmdName}{${innerContent}}`);
          }
          return false;
        case 'command':
          parts.push(child.attrs.latex || '');
          return false;
        default:
          return true;
      }
    });

    return parts.join('');
  }
}