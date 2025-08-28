import { Node as PMNode } from 'prosemirror-model';

export interface RenderingOptions {
  showCommands?: boolean;
}

export abstract class BaseLatexRenderer {
  protected options: RenderingOptions;

  constructor(options: RenderingOptions = {}) {
    this.options = { showCommands: false, ...options };
  }

  abstract canRender(node: PMNode): boolean;
  abstract render(node: PMNode): string;

  protected renderChildren(node: PMNode): string {
    const parts: string[] = [];

    node.descendants((child, pos) => {
      if (child === node) return true;

      switch (child.type.name) {
        case 'text':
          if (child.text) parts.push(child.text);
          return false;
        default:
          return true;
      }
    });

    return parts.join('');
  }
}