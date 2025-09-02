import { EditorView, WidgetType } from '@codemirror/view';
import { LatexToken } from '../parsers/base-parser';
import { LatexTokenizer } from '../parsers/main-parser';
import { SectionWidget } from './widgets/section-widget';
import { MathWidget } from './widgets/math-widget';
import { EnvironmentWidget } from './widgets/environment-widget';
import { CommandWidget } from './widgets/command-widget';
import { TableWidget } from './widgets/table-widget';

export class WidgetFactory {
  private static tokenizer = new LatexTokenizer();

  static createWidget(token: LatexToken, showCommands: boolean = false): WidgetType | null {
    switch (token.type) {
      case 'section':
        return new SectionWidget(token, showCommands);
      case 'math_inline':
        return new MathWidget(token, false, showCommands);
      case 'math_display':
        return new MathWidget(token, true, showCommands);
      case 'environment':
        if (token.name === 'tabular') {
          return new TableWidget(token, showCommands);
        }
        return new EnvironmentWidget(token, showCommands);
      case 'editable_command':
      case 'command':
        return new CommandWidget(token, showCommands);
      default:
        return null;
    }
  }


}