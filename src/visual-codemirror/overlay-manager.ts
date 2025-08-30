import { EditorState } from '@codemirror/state';
import { Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { LatexTokenizer } from '../parsers/main-parser';
import { SectionWidget } from './widgets/section-widget';
import { MathWidget } from './widgets/math-widget';
import { EnvironmentWidget } from './widgets/environment-widget';
import { CommandWidget } from './widgets/command-widget';
import { TableWidget } from './widgets/table-widget';

export class OverlayManager {
  private tokenizer = new LatexTokenizer();

  createDecorations(state: EditorState): DecorationSet {
    const decorations: any[] = [];
    const doc = state.doc;
    const text = doc.toString();

    if (!text.trim()) {
      return Decoration.none;
    }

    try {
      const tokens = this.tokenizer.tokenize(text);

      for (const token of tokens) {
        const from = text.indexOf(token.latex);
        if (from === -1) continue;

        const to = from + token.latex.length;

        // Validate positions
        if (from < 0 || to > text.length || from >= to) {
          continue;
        }

        let widget: WidgetType | null = null;

        switch (token.type) {
          case 'section':
            widget = new SectionWidget(token);
            if (widget) {
              decorations.push(Decoration.replace({
                widget,
                block: true
              }).range(from, to));
            }
            break;

          case 'math_inline':
            widget = new MathWidget(token, false);
            if (widget) {
              decorations.push(Decoration.replace({
                widget
              }).range(from, to));
            }
            break;

          case 'math_display':
            widget = new MathWidget(token, true);
            if (widget) {
              decorations.push(Decoration.replace({
                widget,
                block: true
              }).range(from, to));
            }
            break;

          case 'environment':
            if (token.name === 'tabular') {
              widget = new TableWidget(token);
            } else {
              widget = new EnvironmentWidget(token);
            }
            if (widget) {
              decorations.push(Decoration.replace({
                widget,
                block: true
              }).range(from, to));
            }
            break;

          case 'editable_command':
          case 'command':
            if (token.name && ['textbf', 'textit', 'emph', 'underline', 'textcolor', 'colorbox'].includes(token.name)) {
              widget = new CommandWidget(token);
              if (widget) {
                decorations.push(Decoration.replace({
                  widget
                }).range(from, to));
              }
            }
            break;
        }
      }
    } catch (error) {
      console.warn('Error creating decorations:', error);
      return Decoration.none;
    }

    try {
      return Decoration.set(decorations.sort((a, b) => a.from - b.from));
    } catch (error) {
      console.warn('Error creating decoration set:', error);
      return Decoration.none;
    }
  }
}