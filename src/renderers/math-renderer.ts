import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class MathRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'math_inline' || node.type.name === 'math_display';
  }

  render(node: PMNode): string {
    const latex = node.attrs.latex || '';

    if (node.type.name === 'math_inline') {
      return `$${latex}$`;
    } else {
      return `$$${latex}$$`;
    }
  }
}