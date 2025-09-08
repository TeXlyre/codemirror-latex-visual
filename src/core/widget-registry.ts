// src/core/widget-registry.ts
import { EditorView } from '@codemirror/view';
import { LatexToken } from '../parsers/base-parser';
import { EventService } from './event-service';
import { errorService, ErrorCategory, ErrorSeverity } from './error-service';

export interface WidgetInstance {
  id: string;
  type: string;
  element: HTMLElement;
  token: LatexToken;
  isEditing: boolean;
  metadata?: any;
  createdAt: number;
  lastUpdated: number;
}

export interface WidgetUpdateData {
  id: string;
  oldLatex: string;
  newLatex: string;
  source: 'user' | 'programmatic';
}

export class WidgetRegistry {
  private widgets: Map<string, WidgetInstance> = new Map();
  private widgetsByElement: WeakMap<HTMLElement, string> = new WeakMap();
  private widgetsByToken: Map<string, string> = new Map();
  private eventService: EventService;
  private editorView: EditorView;

  constructor(eventService: EventService, editorView: EditorView) {
    this.eventService = eventService;
    this.editorView = editorView;
  }

  register(
    type: string,
    element: HTMLElement,
    token: LatexToken,
    metadata?: any
  ): WidgetInstance {
    const id = this.generateWidgetId(type);
    const now = Date.now();

    const widget: WidgetInstance = {
      id,
      type,
      element,
      token,
      isEditing: false,
      metadata,
      createdAt: now,
      lastUpdated: now
    };

    this.widgets.set(id, widget);
    this.widgetsByElement.set(element, id);

    const tokenKey = this.getTokenKey(token);
    this.widgetsByToken.set(tokenKey, id);

    element.dataset.widgetId = id;
    element.dataset.widgetType = type;

    return widget;
  }

  unregister(id: string): boolean {
    const widget = this.widgets.get(id);
    if (!widget) return false;

    this.widgetsByElement.delete(widget.element);

    const tokenKey = this.getTokenKey(widget.token);
    this.widgetsByToken.delete(tokenKey);

    delete widget.element.dataset.widgetId;
    delete widget.element.dataset.widgetType;

    this.widgets.delete(id);
    return true;
  }

  getWidget(id: string): WidgetInstance | undefined {
    return this.widgets.get(id);
  }

  getWidgetByElement(element: HTMLElement): WidgetInstance | undefined {
    const id = this.widgetsByElement.get(element);
    return id ? this.widgets.get(id) : undefined;
  }

  getWidgetByToken(token: LatexToken): WidgetInstance | undefined {
    const tokenKey = this.getTokenKey(token);
    const id = this.widgetsByToken.get(tokenKey);
    return id ? this.widgets.get(id) : undefined;
  }

  getAllWidgets(): WidgetInstance[] {
    return Array.from(this.widgets.values());
  }

  getWidgetsByType(type: string): WidgetInstance[] {
    return this.getAllWidgets().filter(widget => widget.type === type);
  }

  updateWidget(
    id: string,
    newToken: LatexToken,
    source: 'user' | 'programmatic' = 'programmatic'
  ): boolean {
    const widget = this.widgets.get(id);
    if (!widget) {
      errorService.logError(
        ErrorCategory.WIDGET,
        ErrorSeverity.ERROR,
        `Attempted to update non-existent widget: ${id}`,
        { id, newToken }
      );
      return false;
    }

    const oldLatex = widget.token.latex;
    const newLatex = newToken.latex;

    if (oldLatex === newLatex) {
      return true; // No change needed
    }

    try {
      // Update token mapping
      const oldTokenKey = this.getTokenKey(widget.token);
      const newTokenKey = this.getTokenKey(newToken);

      if (oldTokenKey !== newTokenKey) {
        this.widgetsByToken.delete(oldTokenKey);
        this.widgetsByToken.set(newTokenKey, id);
      }

      // Update widget
      widget.token = newToken;
      widget.lastUpdated = Date.now();

      // Update editor
      this.updateEditorContent(widget, oldLatex, newLatex);

      // Emit update event
      this.eventService.emitWidgetUpdate({
        widgetId: id,
        widgetType: widget.type,
        oldValue: oldLatex,
        newValue: newLatex,
        source
      });

      return true;
    } catch (error) {
      errorService.logError(
        ErrorCategory.WIDGET,
        ErrorSeverity.ERROR,
        `Failed to update widget: ${id}`,
        { id, oldLatex, newLatex, error }
      );
      return false;
    }
  }

  setEditingState(id: string, isEditing: boolean): boolean {
    const widget = this.widgets.get(id);
    if (!widget) return false;

    widget.isEditing = isEditing;
    widget.lastUpdated = Date.now();

    if (isEditing) {
      widget.element.classList.add('editing');
    } else {
      widget.element.classList.remove('editing');
    }

    return true;
  }

  findWidgetAtPosition(position: number): WidgetInstance | undefined {
    const doc = this.editorView.state.doc.toString();

    for (const widget of this.widgets.values()) {
      const tokenStart = doc.indexOf(widget.token.latex);
      if (tokenStart === -1) continue;

      const tokenEnd = tokenStart + widget.token.latex.length;
      if (position >= tokenStart && position <= tokenEnd) {
        return widget;
      }
    }

    return undefined;
  }

  getEditingWidgets(): WidgetInstance[] {
    return this.getAllWidgets().filter(widget => widget.isEditing);
  }

  cleanup(): void {
    // Stop any editing states
    for (const widget of this.widgets.values()) {
      if (widget.isEditing) {
        this.setEditingState(widget.id, false);
      }
    }

    this.widgets.clear();
    this.widgetsByToken.clear();
    // Note: WeakMap will be garbage collected automatically
  }

  // Utility methods
  getWidgetStats(): {
    total: number;
    byType: Record<string, number>;
    editing: number;
    averageAge: number;
  } {
    const widgets = this.getAllWidgets();
    const now = Date.now();

    const byType: Record<string, number> = {};
    let totalAge = 0;
    let editingCount = 0;

    for (const widget of widgets) {
      byType[widget.type] = (byType[widget.type] || 0) + 1;
      totalAge += now - widget.createdAt;

      if (widget.isEditing) {
        editingCount++;
      }
    }

    return {
      total: widgets.length,
      byType,
      editing: editingCount,
      averageAge: widgets.length > 0 ? totalAge / widgets.length : 0
    };
  }

  private generateWidgetId(type: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `widget_${type}_${timestamp}_${random}`;
  }

  private getTokenKey(token: LatexToken): string {
    return `${token.type}_${token.start}_${token.end}_${token.latex}`;
  }

  private updateEditorContent(
    widget: WidgetInstance,
    oldLatex: string,
    newLatex: string
  ): void {
    const doc = this.editorView.state.doc.toString();
    const start = doc.indexOf(oldLatex);

    if (start === -1) {
      errorService.logError(
        ErrorCategory.WIDGET,
        ErrorSeverity.WARN,
        `Could not find widget content in editor for update`,
        { widgetId: widget.id, oldLatex, newLatex }
      );
      return;
    }

    const end = start + oldLatex.length;

    this.editorView.dispatch({
      changes: { from: start, to: end, insert: newLatex }
    });
  }
}