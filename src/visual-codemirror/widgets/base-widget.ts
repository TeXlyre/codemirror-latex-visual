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
    // Never ignore events - let them all reach the widget content
    return false;
  }

  protected makeEditable(element: HTMLElement, view: EditorView, onUpdate: (newContent: string) => void) {
    element.contentEditable = 'true';
    element.style.outline = 'none';
    element.style.cursor = 'text';
    element.style.userSelect = 'text';
    element.style.webkitUserSelect = 'text';

    // Only stop propagation for specific events that need it
    element.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        element.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        element.blur();
      }
    });

    element.addEventListener('input', (e) => {
      e.stopPropagation();
    });

    element.addEventListener('blur', () => {
      const newContent = element.textContent || '';
      onUpdate(newContent);
    });

    element.addEventListener('focus', (e) => {
      e.stopPropagation();
    });

    return element;
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

  protected findTokenInDocument(view: EditorView) {
    const doc = view.state.doc;
    const text = doc.toString();
    const index = text.indexOf(this.token.latex);

    if (index === -1) return null;

    return {
      from: index,
      to: index + this.token.latex.length
    };
  }

  protected updateTokenInEditor(view: EditorView, newLatex: string) {
    const pos = this.findTokenInDocument(view);
    if (pos === null) return;

    const { from, to } = pos;
    view.dispatch({
      changes: { from, to, insert: newLatex }
    });
  }
}