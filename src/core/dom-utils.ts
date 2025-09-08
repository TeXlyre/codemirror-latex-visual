// src/core/dom-utils.ts
import { LatexEditorConfig } from './config';
import { errorService, ErrorCategory, ErrorSeverity } from './error-service';

export interface StyleOptions {
  className?: string;
  styles?: Partial<CSSStyleDeclaration>;
  attributes?: Record<string, string>;
}

export interface EditableElementOptions {
  placeholder?: string;
  singleLine?: boolean;
  autoFocus?: boolean;
  selectAllOnFocus?: boolean;
  onUpdate?: (value: string) => void;
  onEscape?: () => void;
  onEnter?: () => void;
}

export class DOMUtils {
  private config: LatexEditorConfig;

  constructor(config: LatexEditorConfig) {
    this.config = config;
  }

  createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options: StyleOptions = {}
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);

    if (options.className) {
      element.className = options.className;
    }

    if (options.styles) {
      Object.assign(element.style, options.styles);
    }

    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    return element;
  }

  createEditableElement(
    tagName: keyof HTMLElementTagNameMap = 'span',
    options: EditableElementOptions & StyleOptions = {}
  ): HTMLElement {
    const element = this.createElement(tagName, options);

    element.contentEditable = 'true';
    element.style.outline = 'none';
    element.style.cursor = 'text';

    if (options.singleLine) {
      element.dataset.singleLine = 'true';
      element.style.whiteSpace = 'nowrap';
    }

    if (options.placeholder) {
      element.dataset.placeholder = options.placeholder;
      this.updatePlaceholder(element);
    }

    this.setupEditableEvents(element, options);

    return element;
  }

  createButton(
    text: string,
    onClick: (event: MouseEvent) => void,
    options: StyleOptions = {}
  ): HTMLButtonElement {
    const button = this.createElement('button', {
      ...options,
      attributes: {
        type: 'button',
        ...options.attributes
      }
    });

    button.textContent = text;
    button.addEventListener('click', onClick);

    return button;
  }

  createColoredElement(
    tagName: keyof HTMLElementTagNameMap,
    colorKey: keyof LatexEditorConfig['styles']['colors'],
    options: StyleOptions = {}
  ): HTMLElement {
    const element = this.createElement(tagName, options);
    const color = this.config.styles.colors[colorKey];

    element.style.borderColor = color;
    element.style.color = color;

    return element;
  }

  applyWidgetStyles(element: HTMLElement, widgetType: string): void {
    const baseStyles: Partial<CSSStyleDeclaration> = {
      margin: this.config.styles.spacing.widget,
      lineHeight: '1.4',
      position: 'relative'
    };

    Object.assign(element.style, baseStyles);

    const colorKey = this.getColorKeyForWidget(widgetType);
    if (colorKey) {
      element.style.borderLeftColor = this.config.styles.colors[colorKey];
    }
  }

  preserveLineHeight(element: HTMLElement, originalText: string): void {
    const newlineCount = (originalText.match(/\n/g) || []).length;
    if (newlineCount > 0) {
      element.style.minHeight = `${(newlineCount + 1) * 1.4}em`;
    }
  }

  positionCursorFromClick(element: HTMLElement, clickX: number): void {
    try {
      const rect = element.getBoundingClientRect();
      const text = element.textContent || '';
      const relativeX = clickX - rect.left - 4;
      const charWidth = Math.max((rect.width - 8) / text.length, 8);
      const charIndex = Math.max(0, Math.min(Math.round(relativeX / charWidth), text.length));

      if (element.firstChild) {
        const range = document.createRange();
        range.setStart(element.firstChild, charIndex);
        range.collapse(true);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.DOM,
        ErrorSeverity.WARN,
        'Failed to position cursor from click',
        { element, clickX, error }
      );

      this.selectAllContent(element);
    }
  }

  selectAllContent(element: HTMLElement): void {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch (error) {
      errorService.logError(
        ErrorCategory.DOM,
        ErrorSeverity.WARN,
        'Failed to select all content',
        { element, error }
      );
    }
  }

  selectContentInBraces(element: HTMLElement): void {
    try {
      const text = element.textContent || '';
      const lastBraceIndex = text.lastIndexOf('{');
      const closingBraceIndex = text.lastIndexOf('}');

      if (lastBraceIndex !== -1 && closingBraceIndex > lastBraceIndex && element.firstChild) {
        const range = document.createRange();
        range.setStart(element.firstChild, lastBraceIndex + 1);
        range.setEnd(element.firstChild, closingBraceIndex);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else {
        this.selectAllContent(element);
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.DOM,
        ErrorSeverity.WARN,
        'Failed to select content in braces',
        { element, error }
      );

      this.selectAllContent(element);
    }
  }

  findNextFocusableElement(currentElement: HTMLElement): HTMLElement | null {
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .latex-command-wrapper, [contenteditable="true"]';
    const focusableElements = Array.from(document.querySelectorAll(focusableSelector)) as HTMLElement[];

    const currentIndex = focusableElements.indexOf(currentElement);
    return currentIndex > -1 && currentIndex < focusableElements.length - 1
      ? focusableElements[currentIndex + 1]
      : null;
  }

  isElementVisible(element: HTMLElement): boolean {
    return !!(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    );
  }

  waitForElement(selector: string, timeout = 5000): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), wait);
    };
  }

  private setupEditableEvents(element: HTMLElement, options: EditableElementOptions): void {
    const updatePlaceholder = () => this.updatePlaceholder(element);

    element.addEventListener('input', (e) => {
      e.stopPropagation();
      updatePlaceholder();

      if (options.onUpdate) {
        options.onUpdate(element.textContent || '');
      }
    });

    element.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Escape') {
        e.preventDefault();
        if (options.onEscape) {
          options.onEscape();
        } else {
          element.blur();
        }
      } else if (e.key === 'Enter' && (!e.shiftKey || options.singleLine)) {
        e.preventDefault();
        if (options.onEnter) {
          options.onEnter();
        } else {
          element.blur();
        }
      }
    });

    element.addEventListener('focus', (e) => {
      e.stopPropagation();
      updatePlaceholder();

      if (options.selectAllOnFocus || options.autoFocus) {
        setTimeout(() => this.selectAllContent(element), 0);
      }
    });

    element.addEventListener('blur', () => {
      updatePlaceholder();

      if (options.onUpdate) {
        options.onUpdate(element.textContent || '');
      }
    });

    // Prevent event bubbling for interaction events
    ['mousedown', 'click'].forEach(eventType => {
      element.addEventListener(eventType, (e) => {
        e.stopPropagation();
      });
    });

    if (options.autoFocus) {
      setTimeout(() => element.focus(), this.config.defaultTimeouts.focus);
    }
  }

  private updatePlaceholder(element: HTMLElement): void {
    const placeholder = element.dataset.placeholder;
    if (!placeholder) return;

    const isEmpty = !element.textContent?.trim();

    if (isEmpty && document.activeElement !== element) {
      element.dataset.empty = 'true';
      if (!element.querySelector('.placeholder')) {
        const placeholderSpan = this.createElement('span', {
          className: 'placeholder',
          styles: {
            color: '#999',
            fontStyle: 'italic',
            pointerEvents: 'none',
            position: 'absolute'
          }
        });
        placeholderSpan.textContent = placeholder;
        element.appendChild(placeholderSpan);
      }
    } else {
      delete element.dataset.empty;
      const placeholderElement = element.querySelector('.placeholder');
      if (placeholderElement) {
        placeholderElement.remove();
      }
    }
  }

  private getColorKeyForWidget(widgetType: string): keyof LatexEditorConfig['styles']['colors'] | null {
    const colorMap: Record<string, keyof LatexEditorConfig['styles']['colors']> = {
      'math': 'math',
      'environment': 'environment',
      'command': 'command',
      'table': 'table',
      'section': 'primary'
    };

    return colorMap[widgetType] || null;
  }
}