import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class CommandRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'command' || node.type.name === 'editable_command';
  }

  render(node: PMNode): string {
    if (node.type.name === 'editable_command') {
      const cmdName = node.attrs.name;

      if ((cmdName === 'textcolor' || cmdName === 'colorbox') && node.attrs.colorArg) {
        const innerContent = this.renderContent(node);
        return `\\${cmdName}{${node.attrs.colorArg}}{${innerContent}}`;
      }

      const innerContent = this.renderContent(node);
      return `\\${cmdName}{${innerContent}}`;
    } else {
      return node.attrs.latex || '';
    }
  }

  private renderContent(node: PMNode): string {
    const parts: string[] = [];

    node.descendants((child, pos) => {
      if (child === node) return true;

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
            const innerContent = this.renderContent(child);
            parts.push(`\\${cmdName}{${child.attrs.colorArg}}{${innerContent}}`);
          } else {
            const innerContent = this.renderContent(child);
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