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
    // Don't create widgets for incomplete constructs
    if (!this.isCompleteToken(token)) {
      return null;
    }

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

  private static isCompleteToken(token: LatexToken): boolean {
    const latex = token.latex;

    // Check for incomplete commands (just backslash + letters without braces)
    if (token.type === 'text' && latex.startsWith('\\')) {
      return false;
    }

    // Check for incomplete sections
    if (token.type === 'section') {
      return latex.includes('{') && latex.includes('}');
    }

    // Check for incomplete environments
    if (token.type === 'environment') {
      const envName = token.name || '';
      return latex.includes(`\\begin{${envName}}`) && latex.includes(`\\end{${envName}}`);
    }

    // Check for incomplete commands
    if (token.type === 'command' || token.type === 'editable_command') {
      // Must have proper braces structure
      if (!latex.includes('{') || !latex.includes('}')) {
        return false;
      }

      // Count braces to ensure they're balanced
      let braceCount = 0;
      for (let i = 0; i < latex.length; i++) {
        if (latex[i] === '{') braceCount++;
        if (latex[i] === '}') braceCount--;
      }
      return braceCount === 0;
    }

    // Check for complete math - be very strict
    if (token.type === 'math_inline') {
      // Must start and end with $ and have content
      if (!latex.startsWith('$') || !latex.endsWith('$') || latex.length < 3) {
        return false;
      }
      // Make sure it's properly formed (not just $ or containing $$)
      if (latex === '$' || latex.includes('$$')) {
        return false;
      }
      // Count dollars to ensure they're balanced
      const dollarCount = (latex.match(/\$/g) || []).length;
      return dollarCount === 2;
    }

    if (token.type === 'math_display') {
      // Must start and end with $$ and have content
      if (!latex.startsWith('$$') || !latex.endsWith('$$') || latex.length < 5) {
        return false;
      }
      // Make sure it's properly formed
      if (latex === '$$') {
        return false;
      }
      // Count $$ pairs to ensure they're balanced
      const content = latex.slice(2, -2);
      if (content.includes('$$')) {
        return false; // Nested $$ not allowed
      }
      return true;
    }

    return true;
  }
}