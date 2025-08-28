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
      const innerLatex = this.renderChildren(node);
      return `\\begin{${envName}}\n${innerLatex}\n\\end{${envName}}`;
    } else {
      return node.attrs.latex || '';
    }
  }
}