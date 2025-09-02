import { EditorState } from '@codemirror/state';
import { Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { LatexTokenizer } from '../parsers/main-parser';
import { WidgetFactory } from './widget-factory';

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
      const showCommands = (window as any).latexEditorShowCommands || false;

      for (const token of tokens) {
        if (token.type === 'text' || token.type === 'paragraph_break') {
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

  private findTokenPosition(text: string, token: any): number {
    if (typeof token.start === 'number' && token.start >= 0) {
      return token.start;
    }

    return text.indexOf(token.latex);
  }
}