import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer } from './base-renderer';

export class SectionRenderer extends BaseLatexRenderer {
  canRender(node: PMNode): boolean {
    return node.type.name === 'section';
  }

  render(node: PMNode): string {
    const level = node.attrs.level || 1;
    const sectionType = level === 1 ? 'section' : level === 2 ? 'subsection' : 'subsubsection';
    const content = node.textContent || '';

    return `\\${sectionType}{${content}}`;
  }
}