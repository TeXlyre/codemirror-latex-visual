import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class EnvironmentRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'environment';
  }

  render(node: PMNode): string {
    if (this.options.showCommands) {
      return node.attrs.latex || '';
    }

    if (node.content.size > 0) {
      const envName = node.attrs.name;
      const innerLatex = this.renderContentWithMath(node);
      return `\\begin{${envName}}\n${innerLatex}\n\\end{${envName}}`;
    } else {
      return node.attrs.latex || '';
    }
  }

  private renderContentWithMath(node: PMNode): string {
    const parts: string[] = [];

    node.descendants((child, pos) => {
      switch (child.type.name) {
        case 'text':
          if (child.text) parts.push(child.text);
          return false;
        case 'math_inline':
          parts.push(`$${child.attrs.latex}$`);
          return false;
        case 'math_display':
          parts.push(`$$${child.attrs.latex}$$`);
          return false;
        case 'editable_command':
          const cmdName = child.attrs.name;
          const innerContent = child.textContent || '';
          parts.push(`\\${cmdName}{${innerContent}}`);
          return false;
        case 'command':
          parts.push(child.attrs.latex || '');
          return false;
        case 'paragraph':
          return true;
        default:
          return true;
      }
    });

    return parts.join('');
  }
}