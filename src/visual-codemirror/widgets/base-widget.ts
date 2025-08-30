import { WidgetType, EditorView } from '@codemirror/view';
import { LatexToken } from '../../parsers/base-parser';

export abstract class BaseLatexWidget extends WidgetType {
  protected token: LatexToken;
  protected showCommands: boolean;

  constructor(token: LatexToken, showCommands: boolean = false) {
    super();
    this.token = token;
    this.showCommands = showCommands || (window as any).latexEditorShowCommands || false;
  }

  eq(other: WidgetType): boolean {
    return other instanceof BaseLatexWidget &&
           other.token.latex === this.token.latex &&
           other.showCommands === this.showCommands;
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    const newElement = this.toDOM(view);
    if (dom.isEqualNode(newElement)) {
      return false;
    }
    dom.replaceWith(newElement);
    return true;
  }

  abstract toDOM(view: EditorView): HTMLElement;

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click';
  }

  protected createCommandWrapper(content: HTMLElement, cmdName: string): HTMLElement {
    if (!this.showCommands) {
      return content;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'latex-command-wrapper';

    const prefix = document.createElement('span');
    prefix.className = 'latex-cmd-prefix';
    prefix.textContent = `\\${cmdName}{`;

    const suffix = document.createElement('span');
    suffix.className = 'latex-cmd-suffix';
    suffix.textContent = '}';

    wrapper.appendChild(prefix);
    wrapper.appendChild(content);
    wrapper.appendChild(suffix);

    return wrapper;
  }
}