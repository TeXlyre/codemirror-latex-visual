import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class ParagraphRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'paragraph' || node.type.name === 'hard_break';
  }

  render(node: PMNode): string {
    if (node.type.name === 'hard_break') {
      return '\n';
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
          if (this.options.showCommands) {
            result += node.attrs.latex;
          } else {
            const cmdName = node.attrs.name;
            const innerContent = node.textContent;
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
}