// src/index.ts (Phase 1 Updated)

// Core services - new exports
export { ConfigService, DEFAULT_CONFIG } from './core/config';
export { EventService } from './core/event-service';
export { FocusService } from './core/focus-service';
export { DOMUtils } from './core/dom-utils';
export { WidgetRegistry } from './core/widget-registry';
export { errorService, ErrorSeverity, ErrorCategory } from './core/error-service';

// Main editor components
export { DualLatexEditor, latexVisualKeymap } from './dual-editor';
export { VisualCodeMirrorEditor } from './visual-codemirror/visual-editor';
export { OverlayManager } from './visual-codemirror/overlay-manager';
export { WidgetFactory } from './visual-codemirror/widget-factory';
export { NestedContentRenderer } from './visual-codemirror/nested-content-renderer';
export { Toolbar } from './visual-toolbar';

// Parser exports
export * from './parsers/base-parser';
export { LatexTokenizer } from './parsers/main-parser';
export { CommentParser } from './parsers/comment-parser';
export { MathParser } from './parsers/math-parser';
export { SectionParser } from './parsers/section-parser';
export { EnvironmentParser } from './parsers/environment-parser';
export { CommandParser, EDITABLE_COMMANDS, FORMATTING_COMMANDS } from './parsers/command-parser';
export { TableParser } from './parsers/table-parser';

// Widget exports
export * from './visual-codemirror/widgets/base-widget';
export { SectionWidget } from './visual-codemirror/widgets/section-widget';
export { MathWidget } from './visual-codemirror/widgets/math-widget';
export { EnvironmentWidget } from './visual-codemirror/widgets/environment-widget';
export { CommandWidget } from './visual-codemirror/widgets/command-widget';
export { TableWidget } from './visual-codemirror/widgets/table-widget';
export { ListWidget } from './visual-codemirror/widgets/list-widget';

// Component exports
export { TableSelector, TableDimensions } from './components/table-selector';

// Type exports for better TypeScript support
export type {
  LatexEditorConfig
} from './core/config';

export type {
  LatexError,
  ErrorRecoveryStrategy
} from './core/error-service';

export type {
  WidgetInstance,
  WidgetUpdateData
} from './core/widget-registry';

export type {
  FocusableElement,
  FocusState
} from './core/focus-service';

export type {
  StyleOptions,
  EditableElementOptions
} from './core/dom-utils';

export type {
  WidgetUpdateEvent,
  ModeChangeEvent,
  FocusChangeEvent
} from './core/event-service';

export type {
  DualEditorOptions
} from './dual-editor';

export type {
  VisualEditorOptions
} from './visual-codemirror/visual-editor';

export type {
  ToolbarOptions
} from './visual-toolbar';