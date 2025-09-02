import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class CommentRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'comment';
  }

  render(node: PMNode): string {
    return node.attrs.latex || '';
  }
}