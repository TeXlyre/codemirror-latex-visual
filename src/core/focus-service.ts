// src/core/focus-service.ts
import { EventService } from './event-service';
import { errorService, ErrorCategory, ErrorSeverity } from './error-service';

export interface FocusableElement {
  element: HTMLElement;
  type: 'widget' | 'editor' | 'toolbar' | 'cell';
  widgetType?: string;
  metadata?: any;
}

export interface FocusState {
  current: FocusableElement | null;
  previous: FocusableElement | null;
  stack: FocusableElement[];
}

export class FocusService {
  private state: FocusState = {
    current: null,
    previous: null,
    stack: []
  };

  private eventService: EventService;
  private cleanupFunctions: Array<() => void> = [];
  private maxStackSize = 10;

  constructor(eventService: EventService) {
    this.eventService = eventService;
    this.setupGlobalFocusTracking();
  }

  getCurrentFocus(): FocusableElement | null {
    return this.state.current;
  }

  getPreviousFocus(): FocusableElement | null {
    return this.state.previous;
  }

  getFocusStack(): FocusableElement[] {
    return [...this.state.stack];
  }

  focusElement(element: HTMLElement, type: FocusableElement['type'], metadata?: any): boolean {
    try {
      const focusable: FocusableElement = {
        element,
        type,
        widgetType: this.detectWidgetType(element),
        metadata
      };

      this.updateFocusState(focusable);
      element.focus();

      this.eventService.emitFocusChange({
        type,
        element,
        widgetType: focusable.widgetType
      });

      return true;
    } catch (error) {
      errorService.logError(
        ErrorCategory.DOM,
        ErrorSeverity.ERROR,
        'Failed to focus element',
        { element, type, metadata, error }
      );
      return false;
    }
  }

  restorePreviousFocus(): boolean {
    if (this.state.previous && this.isElementFocusable(this.state.previous.element)) {
      return this.focusElement(
        this.state.previous.element,
        this.state.previous.type,
        this.state.previous.metadata
      );
    }
    return false;
  }

  findNextFocusableWidget(current?: HTMLElement): HTMLElement | null {
    const currentElement = current || this.state.current?.element;
    if (!currentElement) return null;

    const focusableWidgets = this.getAllFocusableWidgets();
    const currentIndex = focusableWidgets.indexOf(currentElement);

    if (currentIndex === -1) return focusableWidgets[0] || null;

    const nextIndex = (currentIndex + 1) % focusableWidgets.length;
    return focusableWidgets[nextIndex] || null;
  }

  findPreviousFocusableWidget(current?: HTMLElement): HTMLElement | null {
    const currentElement = current || this.state.current?.element;
    if (!currentElement) return null;

    const focusableWidgets = this.getAllFocusableWidgets();
    const currentIndex = focusableWidgets.indexOf(currentElement);

    if (currentIndex === -1) return focusableWidgets[focusableWidgets.length - 1] || null;

    const prevIndex = currentIndex === 0 ? focusableWidgets.length - 1 : currentIndex - 1;
    return focusableWidgets[prevIndex] || null;
  }

  isWidgetFocused(): boolean {
    return this.state.current?.type === 'widget';
  }

  getWidgetType(): string | undefined {
    return this.state.current?.widgetType;
  }

  addFocusableElement(element: HTMLElement, type: FocusableElement['type'], metadata?: any): void {
    element.tabIndex = element.tabIndex >= 0 ? element.tabIndex : 0;
    element.dataset.focusableType = type;

    if (metadata) {
      element.dataset.focusableMetadata = JSON.stringify(metadata);
    }
  }

  removeFocusableElement(element: HTMLElement): void {
    if (this.state.current?.element === element) {
      this.state.current = null;
    }

    this.state.stack = this.state.stack.filter(item => item.element !== element);

    delete element.dataset.focusableType;
    delete element.dataset.focusableMetadata;
  }

  cleanup(): void {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    this.state = {
      current: null,
      previous: null,
      stack: []
    };
  }

  private setupGlobalFocusTracking(): void {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const focusableElement = this.createFocusableFromElement(target);
      if (focusableElement) {
        this.updateFocusState(focusableElement);

        this.eventService.emitFocusChange({
          type: focusableElement.type,
          element: target,
          widgetType: focusableElement.widgetType
        });
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Optional: Handle focus out events if needed
    };

    const focusInCleanup = this.eventService.addGlobalEventListener(
      document,
      'focusin',
      handleFocusIn,
      { capture: true }
    );

    const focusOutCleanup = this.eventService.addGlobalEventListener(
      document,
      'focusout',
      handleFocusOut,
      { capture: true }
    );

    this.cleanupFunctions.push(focusInCleanup, focusOutCleanup);
  }

  private updateFocusState(focusable: FocusableElement): void {
    if (this.state.current) {
      this.state.previous = this.state.current;

      // Add to stack if it's a different element
      if (this.state.current.element !== focusable.element) {
        this.state.stack.unshift(this.state.current);

        // Trim stack to max size
        if (this.state.stack.length > this.maxStackSize) {
          this.state.stack = this.state.stack.slice(0, this.maxStackSize);
        }
      }
    }

    this.state.current = focusable;
  }

  private createFocusableFromElement(element: HTMLElement): FocusableElement | null {
    const type = this.detectElementType(element);
    if (!type) return null;

    const widgetType = this.detectWidgetType(element);
    const metadata = this.extractMetadata(element);

    return {
      element,
      type,
      widgetType,
      metadata
    };
  }

  private detectElementType(element: HTMLElement): FocusableElement['type'] | null {
    if (element.dataset.focusableType) {
      return element.dataset.focusableType as FocusableElement['type'];
    }

    if (element.closest('.latex-visual-widget, .latex-command-wrapper')) {
      return 'widget';
    }

    if (element.closest('.unified-toolbar, .latex-editor-toolbar')) {
      return 'toolbar';
    }

    if (element.closest('.latex-table-cell')) {
      return 'cell';
    }

    if (element.closest('.cm-editor')) {
      return 'editor';
    }

    return null;
  }

  private detectWidgetType(element: HTMLElement): string | undefined {
    const widget = element.closest('.latex-visual-widget, .latex-command-wrapper');
    if (!widget) return undefined;

    // Extract widget type from class names
    const classList = Array.from(widget.classList);

    for (const className of classList) {
      if (className.startsWith('latex-visual-') || className.startsWith('latex-')) {
        return className.replace(/^latex-(visual-)?/, '');
      }
    }

    return undefined;
  }

  private extractMetadata(element: HTMLElement): any {
    try {
      const metadataStr = element.dataset.focusableMetadata;
      return metadataStr ? JSON.parse(metadataStr) : undefined;
    } catch {
      return undefined;
    }
  }

  private isElementFocusable(element: HTMLElement): boolean {
    return (
      element.isConnected &&
      !element.hidden &&
      element.tabIndex >= 0 &&
      !element.hasAttribute('disabled')
    );
  }

  private getAllFocusableWidgets(): HTMLElement[] {
    const widgets = document.querySelectorAll(
      '.latex-visual-widget[tabindex], .latex-command-wrapper[tabindex], [contenteditable="true"]'
    );

    return Array.from(widgets)
      .filter(el => this.isElementFocusable(el as HTMLElement))
      .map(el => el as HTMLElement);
  }
}