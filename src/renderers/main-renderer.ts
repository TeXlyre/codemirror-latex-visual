import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer, RenderingOptions } from './base-renderer';
import { CommentRenderer } from './comment-renderer';
import { MathRenderer } from './math-renderer';
import { SectionRenderer } from './section-renderer';
import { EnvironmentRenderer } from './environment-renderer';
import { CommandRenderer } from './command-renderer';
import { ParagraphRenderer } from './paragraph-renderer';
import { TableRenderer } from './table-renderer';

export class LatexRenderer {
  private renderers: BaseLatexRenderer[];

  constructor(options: RenderingOptions = {}) {
    this.renderers = [
      new CommentRenderer(options),
      new MathRenderer(options),
      new SectionRenderer(options),
      new TableRenderer(options),
      new EnvironmentRenderer(options),
      new CommandRenderer(options),
      new ParagraphRenderer(options)
    ];
  }

  render(pmDoc: PMNode): string {
    const parts: string[] = [];

    pmDoc.content.forEach((node, offset, index) => {
      for (const renderer of this.renderers) {
        if (renderer.canRender(node)) {
          const rendered = renderer.render(node);
          if (rendered !== undefined && rendered !== null) {
            // Only add newlines between paragraphs if the current paragraph is empty
            // (indicating it was created by pressing Enter in the visual editor)
            if (node.type.name === 'paragraph' && rendered === '' && index > 0) {
              const prevPart = parts[parts.length - 1];
              if (prevPart && prevPart.trim() && !prevPart.endsWith('\n')) {
                parts.push('\n\n');
              }
            } else {
              parts.push(rendered);
            }
          }
          return;
        }
      }
    });

    return parts.join('');
  }

  updateOptions(options: RenderingOptions) {
    this.renderers.forEach(renderer => {
      Object.assign(renderer['options'], options);
    });
  }
}