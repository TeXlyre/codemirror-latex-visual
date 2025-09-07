import { EditorView } from '@codemirror/view';
import { LatexTokenizer } from '../parsers/main-parser';
import { WidgetFactory } from './widget-factory';

export class NestedContentRenderer {
  static tokenizer = new LatexTokenizer();
  private static renderDepth = 0;
  private static maxRenderDepth = 5;

  static renderNestedContent(container: HTMLElement, content: string, view: EditorView, showCommands: boolean = false): void {
    if (this.renderDepth > this.maxRenderDepth) {
      console.warn('Maximum render depth exceeded, using plain text');
      container.textContent = content;
      return;
    }

    this.renderDepth++;
    const fragment = this.createNestedContent(content, view, showCommands);
    container.appendChild(fragment);
    this.renderDepth--;
  }

  static setupEditableNestedContent(
    container: HTMLElement,
    content: string,
    view: EditorView,
    onUpdate: (newContent: string) => void,
    showCommands: boolean = false
  ): void {
    if (this.renderDepth > this.maxRenderDepth) {
      console.warn('Maximum render depth exceeded, using simple editable');
      container.textContent = content;
      this.makeSimpleEditable(container, onUpdate);
      return;
    }

    this.renderDepth++;

    if (!content || content.length > 1000) {
      container.textContent = content;
      this.makeSimpleEditable(container, onUpdate);
      this.renderDepth--;
      return;
    }

    try {
      const tokens = this.tokenizer.tokenize(content);
      const hasComplexTokens = tokens.some(token =>
        token.type !== 'text' && token.type !== 'paragraph_break'
      );

      if (hasComplexTokens) {
        container.innerHTML = '';
        const fragment = this.createNestedContent(content, view, showCommands);
        container.appendChild(fragment);
        this.makeContainerEditable(container, onUpdate);
      } else {
        container.textContent = content;
        this.makeSimpleEditable(container, onUpdate);
      }
    } catch (error) {
      console.warn('Error in nested content rendering, falling back to simple text:', error);
      container.textContent = content;
      this.makeSimpleEditable(container, onUpdate);
    }

    this.renderDepth--;
  }

  private static createNestedContent(content: string, view: EditorView, showCommands: boolean = false): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (!content || !content.trim()) {
      return fragment;
    }

    if (content.length > 1000) {
      const textNode = document.createTextNode(content);
      fragment.appendChild(textNode);
      return fragment;
    }

    try {
      const tokens = this.tokenizer.tokenize(content);

      for (const token of tokens) {
        if (token.type === 'text') {
          this.appendTextWithLineBreaks(fragment, token.content);
          continue;
        }

        if (token.type === 'paragraph_break') {
          const br = document.createElement('br');
          fragment.appendChild(br);
          continue;
        }

        const widget = WidgetFactory.createWidget(token, showCommands);
        if (widget) {
          const element = widget.toDOM(view);
          element.dataset.latexOriginal = token.latex;
          element.dataset.tokenType = token.type;
          if ('token' in widget) {
            (element as any)._widgetToken = (widget as any).token;
          }
          fragment.appendChild(element);
        } else {
          this.appendTextWithLineBreaks(fragment, token.latex);
        }
      }
    } catch (error) {
      console.warn('Error creating nested content, using plain text:', error);
      const textNode = document.createTextNode(content);
      fragment.appendChild(textNode);
    }

    return fragment;
  }

  private static appendTextWithLineBreaks(parent: DocumentFragment | HTMLElement, text: string): void {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        const br = document.createElement('br');
        parent.appendChild(br);
      }
      if (lines[i]) {
        const textNode = document.createTextNode(lines[i]);
        parent.appendChild(textNode);
      }
    }
  }

  private static makeSimpleEditable(container: HTMLElement, onUpdate: (newContent: string) => void): void {
    container.contentEditable = 'true';
    container.style.outline = 'none';
    container.style.cursor = 'text';

    container.addEventListener('input', (e) => {
      e.stopPropagation();
      const newContent = container.textContent || '';
      onUpdate(newContent);
    });

    container.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        container.blur();
      }
    });

    container.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    container.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    container.addEventListener('focus', (e) => {
      e.stopPropagation();
    });

    container.addEventListener('blur', () => {
      const newContent = container.textContent || '';
      onUpdate(newContent);
    });
  }

  private static makeContainerEditable(container: HTMLElement, onUpdate: (newContent: string) => void): void {
    container.contentEditable = 'true';
    container.style.outline = 'none';
    container.style.cursor = 'text';

    container.addEventListener('input', (e) => {
      e.stopPropagation();
      const newContent = this.extractContentFromContainer(container);
      onUpdate(newContent);
    });

    container.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey && container.dataset.singleLine === 'true') {
        e.preventDefault();
        container.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        container.blur();
      }
    });

    container.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    container.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    container.addEventListener('blur', () => {
      const newContent = this.extractContentFromContainer(container);
      onUpdate(newContent);
    });
  }

  static extractContentFromContainer(container: HTMLElement): string {
    let result = '';

    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent || '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;

        if (element.tagName === 'BR') {
          result += '\n';
        } else if (element.dataset.latexOriginal) {
          result += element.dataset.latexOriginal;
        } else if (element.classList.contains('latex-visual-widget')) {
          const widgetToken = (element as any)._widgetToken;
          if (widgetToken && widgetToken.latex) {
            result += widgetToken.latex;
          } else {
            result += element.textContent || '';
          }
        } else {
          result += this.extractContentFromContainer(element);
        }
      }
    }

    return result;
  }
}