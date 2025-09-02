import { EditorView } from '@codemirror/view';
import { LatexToken } from '../../parsers/base-parser';
import { LatexTokenizer } from '../../parsers/main-parser';
import { BaseLatexWidget } from './base-widget';
import { SectionWidget } from './section-widget';
import { MathWidget } from './math-widget';
import { EnvironmentWidget } from './environment-widget';
import { CommandWidget } from './command-widget';
import { TableWidget } from './table-widget';

export class WidgetFactory {
  static createWidget(token: LatexToken, showCommands: boolean = false): BaseLatexWidget | null {
    switch (token.type) {
      case 'section':
        return new SectionWidget(token, showCommands);

      case 'math_inline':
        return new MathWidget(token, false);

      case 'math_display':
        return new MathWidget(token, true);

      case 'environment':
        if (token.name === 'tabular') {
          return new TableWidget(token, showCommands);
        } else {
          return new EnvironmentWidget(token, showCommands);
        }

      case 'editable_command':
      case 'command':
        return new CommandWidget(token, showCommands);

      default:
        return null;
    }
  }

  static createNestedWidget(token: LatexToken, view: EditorView, showCommands: boolean = false): HTMLElement | Text {
    if (token.type === 'text') {
      return document.createTextNode(token.content);
    }

    const widget = this.createWidget(token, showCommands);
    if (widget) {
      return widget.toDOM(view);
    }

    return document.createTextNode(token.latex);
  }

  static renderChildren(container: HTMLElement, children: LatexToken[], view: EditorView, showCommands: boolean = false) {
    children.forEach(child => {
      const element = this.createNestedWidget(child, view, showCommands);
      container.appendChild(element);
    });
  }

  static parseContent(content: string): LatexToken[] {
    if (!content.trim()) return [];

    const tokenizer = new LatexTokenizer();
    return tokenizer.tokenize(content);
  }
}