import { Node as PMNode } from 'prosemirror-model';
import { BaseLatexRenderer, RenderingOptions } from './base-renderer';
import { CommentRenderer } from './comment-renderer';
import { MathRenderer } from './math-renderer';
import { SectionRenderer } from './section-renderer';
import { EnvironmentRenderer } from './environment-renderer';
import { CommandRenderer } from './command-renderer';
import { ParagraphRenderer } from './paragraph-renderer';

export class LatexRenderer {
  private renderers: BaseLatexRenderer[];

  constructor(options: RenderingOptions = {}) {
    this.renderers = [
      new CommentRenderer(options),
      new MathRenderer(options),
      new SectionRenderer(options),
      new EnvironmentRenderer(options),
      new CommandRenderer(options),
      new ParagraphRenderer(options)
    ];
  }

  render(pmDoc: PMNode): string {
    const parts: string[] = [];

    pmDoc.descendants((node, pos) => {
      for (const renderer of this.renderers) {
        if (renderer.canRender(node)) {
          const rendered = renderer.render(node);
          if (rendered) {
            parts.push(rendered);
          }
          return false;
        }
      }
      return true;
    });

    return parts.join('\n\n').replace(/\n\n\n+/g, '\n\n').trim();
  }

  updateOptions(options: RenderingOptions) {
    this.renderers.forEach(renderer => {
      Object.assign(renderer['options'], options);
    });
  }
}