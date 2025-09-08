// src/visual-codemirror/nested-content-renderer.ts (Phase 2 Refactored)
import { EditorView } from '@codemirror/view';
import { LatexToken } from '../parsers/base-parser';
import { ParserService } from '../core/parser-service';
import { ConfigService } from '../core/config';
import { WidgetFactory } from './widget-factory';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export class NestedContentRenderer {
  private static parserService: ParserService;
  private static configService: ConfigService;
  private static renderDepth = 0;

  static initialize(configService: ConfigService): void {
    this.configService = configService;
    this.parserService = new ParserService(configService);
  }

  static renderNestedContent(
    container: HTMLElement,
    content: string,
    view: EditorView,
    showCommands: boolean = false,
    preTokenized?: LatexToken[]
  ): void {
    if (!this.parserService) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.ERROR,
        'NestedContentRenderer not initialized',
        { content: content.substring(0, 50) }
      );
      container.textContent = content;
      return;
    }

    const config = this.configService.get();

    if (this.renderDepth > config.maxRenderDepth) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Maximum render depth exceeded',
        { depth: this.renderDepth, maxDepth: config.maxRenderDepth }
      );
      container.textContent = content;
      return;
    }

    this.renderDepth++;

    try {
      const fragment = this.createNestedContent(content, view, showCommands, preTokenized);
      container.appendChild(fragment);
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.ERROR,
        'Failed to render nested content',
        { content: content.substring(0, 100), error }
      );
      container.textContent = content;
    } finally {
      this.renderDepth--;
    }
  }

  static setupEditableNestedContent(
    container: HTMLElement,
    content: string,
    view: EditorView,
    onUpdate: (newContent: string) => void,
    showCommands: boolean = false,
    preTokenized?: LatexToken[]
  ): void {
    const config = this.configService?.get();

    if (!this.parserService || this.renderDepth > (config?.maxRenderDepth || 5)) {
      container.textContent = content;
      this.makeSimpleEditable(container, onUpdate);
      return;
    }

    if (!content || content.length > (config?.maxContentLength || 1000)) {
      container.textContent = content;
      this.makeSimpleEditable(container, onUpdate);
      return;
    }

    this.renderDepth++;

    try {
      const tokens = preTokenized || this.parserService.tokenize(content, {
        showCommands,
        useCache: true
      });

      const hasComplexTokens = tokens.some(token =>
        token.type !== 'text' && token.type !== 'paragraph_break'
      );

      if (hasComplexTokens) {
        container.innerHTML = '';
        const fragment = this.createNestedContent(content, view, showCommands, tokens);
        container.appendChild(fragment);
        this.makeContainerEditable(container, onUpdate);
      } else {
        container.textContent = content;
        this.makeSimpleEditable(container, onUpdate);
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Error in nested content setup, falling back to simple text',
        { content: content.substring(0, 100), error }
      );
      container.textContent = content;
      this.makeSimpleEditable(container, onUpdate);
    } finally {
      this.renderDepth--;
    }
  }

  static renderPreTokenizedContent(
    container: HTMLElement,
    tokens: LatexToken[],
    view: EditorView,
    showCommands: boolean = false
  ): void {
    if (this.renderDepth > (this.configService?.get().maxRenderDepth || 5)) {
      const fallbackContent = tokens.map(t => t.latex).join('');
      container.textContent = fallbackContent;
      return;
    }

    this.renderDepth++;

    try {
      const fragment = document.createDocumentFragment();

      for (const token of tokens) {
        this.appendTokenToFragment(fragment, token, view, showCommands);
      }

      container.appendChild(fragment);
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.ERROR,
        'Failed to render pre-tokenized content',
        { tokenCount: tokens.length, error }
      );
      const fallbackContent = tokens.map(t => t.latex).join('');
      container.textContent = fallbackContent;
    } finally {
      this.renderDepth--;
    }
  }

  private static createNestedContent(
    content: string,
    view: EditorView,
    showCommands: boolean = false,
    preTokenized?: LatexToken[]
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (!content || !content.trim()) {
      return fragment;
    }

    const config = this.configService.get();

    if (content.length > config.maxContentLength) {
      const textNode = document.createTextNode(content);
      fragment.appendChild(textNode);
      return fragment;
    }

    try {
      const tokens = preTokenized || this.parserService.tokenize(content, {
        showCommands,
        maxContentLength: config.maxContentLength,
        useCache: true
      });

      for (const token of tokens) {
        this.appendTokenToFragment(fragment, token, view, showCommands);
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Error creating nested content, using plain text',
        { content: content.substring(0, 100), error }
      );
      const textNode = document.createTextNode(content);
      fragment.appendChild(textNode);
    }

    return fragment;
  }

  private static appendTokenToFragment(
    fragment: DocumentFragment,
    token: LatexToken,
    view: EditorView,
    showCommands: boolean
  ): void {
    try {
      if (token.type === 'text') {
        this.appendTextWithLineBreaks(fragment, token.content);
        return;
      }

      if (token.type === 'paragraph_break') {
        const br = document.createElement('br');
        fragment.appendChild(br);
        return;
      }

      const widget = WidgetFactory.createWidget(token, showCommands);
      if (widget) {
        const element = widget.toDOM(view);
        element.dataset.latexOriginal = token.latex;
        element.dataset.tokenType = token.type;
        (element as any)._widgetToken = token;
        fragment.appendChild(element);
      } else {
        this.appendTextWithLineBreaks(fragment, token.latex);
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Error appending token to fragment',
        { tokenType: token.type, tokenLatex: token.latex.substring(0, 50), error }
      );
      this.appendTextWithLineBreaks(fragment, token.latex);
    }
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

    const debouncedUpdate = this.debounce((newContent: string) => {
      onUpdate(newContent);
    }, this.configService?.get().defaultTimeouts.update || 0);

    container.addEventListener('input', (e) => {
      e.stopPropagation();
      const newContent = container.textContent || '';
      debouncedUpdate(newContent);
    });

    container.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        container.blur();
      }
    });

    this.setupEditableEventHandlers(container, () => {
      const newContent = container.textContent || '';
      onUpdate(newContent);
    });
  }

  private static makeContainerEditable(container: HTMLElement, onUpdate: (newContent: string) => void): void {
    container.contentEditable = 'true';
    container.style.outline = 'none';
    container.style.cursor = 'text';

    const debouncedUpdate = this.debounce((newContent: string) => {
      onUpdate(newContent);
    }, this.configService?.get().defaultTimeouts.update || 0);

    container.addEventListener('input', (e) => {
      e.stopPropagation();
      const newContent = this.extractContentFromContainer(container);
      debouncedUpdate(newContent);
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

    this.setupEditableEventHandlers(container, () => {
      const newContent = this.extractContentFromContainer(container);
      onUpdate(newContent);
    });
  }

  private static setupEditableEventHandlers(container: HTMLElement, onUpdate: () => void): void {
    ['mousedown', 'click', 'focus'].forEach(eventType => {
      container.addEventListener(eventType, (e) => {
        e.stopPropagation();
      });
    });

    container.addEventListener('blur', onUpdate);
  }

  static extractContentFromContainer(container: HTMLElement): string {
    let result = '';

    try {
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
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Error extracting content from container',
        { error }
      );
      result = container.textContent || '';
    }

    return result;
  }

  private static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), wait);
    };
  }

  static cleanup(): void {
    this.renderDepth = 0;
    if (this.parserService) {
      this.parserService.cleanup();
    }
  }
}