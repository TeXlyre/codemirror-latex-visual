import { EditorState } from '@codemirror/state';
import { Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { LatexTokenizer } from '../parsers/main-parser';
import { WidgetFactory } from './widget-factory';

export class OverlayManager {
  private tokenizer = new LatexTokenizer();

  createDecorations(state: EditorState, showCommands: boolean = false): DecorationSet {
    const decorations: any[] = [];
    const doc = state.doc;
    const text = doc.toString();

    if (!text.trim()) {
      return Decoration.none;
    }

    try {
      const tokens = this.tokenizer.tokenize(text);

      for (const token of tokens) {
        // Skip text tokens and incomplete constructs
        if (token.type === 'text' || token.type === 'paragraph_break') {
          continue;
        }

        // Don't render incomplete constructs
        if (!this.isCompleteConstruct(token)) {
          continue;
        }

        const from = this.findTokenPosition(text, token);
        if (from === -1) continue;

        const to = from + token.latex.length;

        if (from < 0 || to > text.length || from >= to) {
          continue;
        }

        const widget = WidgetFactory.createWidget(token, showCommands);

        if (widget) {
          const decorationConfig = token.type === 'section' ||
                                  token.type === 'math_display' ||
                                  token.type === 'environment'
                                  ? { widget, block: true }
                                  : { widget };

          decorations.push(Decoration.replace(decorationConfig).range(from, to));
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

  private isCompleteConstruct(token: any): boolean {
    const latex = token.latex;

    // Don't render incomplete commands
    if (latex.startsWith('\\') && !latex.includes('{')) {
      return false;
    }

    // Don't render commands without closing braces
    if ((token.type === 'command' || token.type === 'editable_command') &&
        (!latex.includes('{') || !latex.includes('}'))) {
      return false;
    }

    // Don't render incomplete environments
    if (token.type === 'environment') {
      const envName = token.name || '';
      if (!latex.includes(`\\begin{${envName}}`) || !latex.includes(`\\end{${envName}}`)) {
        return false;
      }
    }

    // Don't render incomplete sections
    if (token.type === 'section') {
      if (!latex.includes('{') || !latex.includes('}')) {
        return false;
      }
    }

    // Don't render incomplete math - be strict about this
    if (token.type === 'math_inline') {
      if (!latex.startsWith('$') || !latex.endsWith('$') || latex.length < 3) {
        return false;
      }
      // Don't render single $
      if (latex === '$') {
        return false;
      }
    }

    if (token.type === 'math_display') {
      if (!latex.startsWith('$$') || !latex.endsWith('$$') || latex.length < 5) {
        return false;
      }
      // Don't render just $$
      if (latex === '$$') {
        return false;
      }
    }

    return true;
  }

  private findTokenPosition(text: string, token: any): number {
    if (typeof token.start === 'number' && token.start >= 0) {
      return token.start;
    }

    return text.indexOf(token.latex);
  }
}