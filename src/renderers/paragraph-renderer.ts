import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class ParagraphRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'paragraph' || node.type.name === 'hard_break' || node.type.name === 'paragraph_break';
  }

  render(node: PMNode): string {
    if (node.type.name === 'hard_break') {
      return '\n';
    }

    if (node.type.name === 'paragraph_break') {
      return node.attrs.latex || '\n\n';
    }

    if (node.content.size > 0) {
      return this.renderParagraphContent(node);
    }

    return '';
  }

  private renderParagraphContent(paragraphNode: PMNode): string {
    let result = '';

    paragraphNode.descendants((node, pos) => {
      switch (node.type.name) {
        case 'text':
          result += node.text || '';
          return false;
        case 'math_inline':
          result += `$${node.attrs.latex}$`;
          return false;
        case 'editable_command':
          const cmdName = node.attrs.name;
          if ((cmdName === 'textcolor' || cmdName === 'colorbox') && node.attrs.colorArg) {
            const innerContent = this.renderCommandContent(node);
            result += `\\${cmdName}{${node.attrs.colorArg}}{${innerContent}}`;
          } else {
            const innerContent = this.renderCommandContent(node);
            result += `\\${cmdName}{${innerContent}}`;
          }
          return false;
        case 'command':
          result += node.attrs.latex;
          return false;
        default:
          return true;
      }
    });

    return result;
  }

  private renderCommandContent(node: PMNode): string {
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
            const innerContent = this.renderCommandContent(child);
            parts.push(`\\${cmdName}{${child.attrs.colorArg}}{${innerContent}}`);
          } else {
            const innerContent = this.renderCommandContent(child);
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