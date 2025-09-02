import { EditorView } from '@codemirror/view';
import { LatexTokenizer } from '../parsers/main-parser';
import { WidgetFactory } from './widget-factory';

export class NestedContentRenderer {
  static tokenizer = new LatexTokenizer();

  static renderNestedContent(container: HTMLElement, content: string, view: EditorView, showCommands: boolean = false): void {
    const fragment = this.createNestedContent(content, view, showCommands);
    container.appendChild(fragment);
  }

  static setupEditableNestedContent(
    container: HTMLElement,
    content: string,
    view: EditorView,
    onUpdate: (newContent: string) => void,
    showCommands: boolean = false
  ): void {
    // Only render nested content if it contains widgets, otherwise use plain text
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
      // Simple text content - just make it directly editable
      container.textContent = content;
      this.makeSimpleEditable(container, onUpdate);
    }
  }

  private static createNestedContent(content: string, view: EditorView, showCommands: boolean = false): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (!content.trim()) {
      return fragment;
    }

    const tokens = this.tokenizer.tokenize(content);

    for (const token of tokens) {
      if (token.type === 'text' || token.type === 'paragraph_break') {
        const textNode = document.createTextNode(token.content);
        fragment.appendChild(textNode);
        continue;
      }

      const widget = WidgetFactory.createWidget(token, showCommands);
      if (widget) {
        const element = widget.toDOM(view);
        element.dataset.latexOriginal = token.latex;
        fragment.appendChild(element);
      } else {
        const textNode = document.createTextNode(token.latex);
        fragment.appendChild(textNode);
      }
    }

    return fragment;
  }

  private static makeSimpleEditable(container: HTMLElement, onUpdate: (newContent: string) => void): void {
    container.contentEditable = 'true';
    container.style.outline = 'none';
    container.style.cursor = 'text';

    let updateTimeout: number;
    const scheduleUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = window.setTimeout(() => {
        const newContent = container.textContent || '';
        onUpdate(newContent);
      }, 500); // Longer delay to avoid interrupting typing
    };

    container.addEventListener('input', (e) => {
      e.stopPropagation();
      scheduleUpdate();
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

    // Don't update on blur for simple text to avoid losing focus during typing
    container.addEventListener('blur', () => {
      clearTimeout(updateTimeout);
      const newContent = container.textContent || '';
      onUpdate(newContent);
    });
  }

  private static makeContainerEditable(container: HTMLElement, onUpdate: (newContent: string) => void): void {
    container.contentEditable = 'true';
    container.style.outline = 'none';
    container.style.cursor = 'text';

    let updateTimeout: number;
    const scheduleUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = window.setTimeout(() => {
        const newContent = this.extractContentFromContainer(container);
        onUpdate(newContent);
      }, 500); // Longer delay for complex content too
    };

    container.addEventListener('input', (e) => {
      e.stopPropagation();
      scheduleUpdate();
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
  }

  static extractContentFromContainer(container: HTMLElement): string {
    let result = '';

    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent || '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;

        if (element.dataset.latexOriginal) {
          result += element.dataset.latexOriginal;
        } else if (element.classList.contains('latex-visual-widget')) {
          result += element.textContent || '';
        } else {
          result += element.textContent || '';
        }
      }
    }

    return result;
  }
}