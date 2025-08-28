import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class CommandRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'command' || node.type.name === 'editable_command';
  }

  render(node: PMNode): string {
    if (this.options.showCommands) {
      return node.attrs.latex || '';
    }

    if (node.type.name === 'editable_command') {
      const cmdName = node.attrs.name;
      const innerContent = node.textContent || '';
      return `\\${cmdName}{${innerContent}}`;
    } else {
      return node.attrs.latex || '';
    }
  }
}