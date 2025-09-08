import { WidgetType } from '@codemirror/view';
import { LatexToken } from '../parsers/base-parser';
import { SectionWidget } from './widgets/section-widget';
import { MathWidget } from './widgets/math-widget';
import { EnvironmentWidget } from './widgets/environment-widget';
import { CommandWidget } from './widgets/command-widget';
import { TableWidget } from './widgets/table-widget';
import { ListWidget } from './widgets/list-widget';

export class WidgetFactory {

  static createWidget(token: LatexToken, showCommands: boolean = false): WidgetType | null {
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
        if (this.isListEnvironment(token.name || '')) {
          return new ListWidget(token, showCommands);
        }
        return new EnvironmentWidget(token, showCommands);
      case 'editable_command':
      case 'command':
        return new CommandWidget(token, showCommands);
      default:
        return null;
    }
  }

  private static isListEnvironment(envName: string): boolean {
    return ['enumerate', 'itemize', 'description'].includes(envName);
  }

  private static isCompleteToken(token: LatexToken): boolean {
    const latex = token.latex;

    if (token.type === 'text' && latex.startsWith('\\')) {
      return false;
    }

    if (token.type === 'section') {
      return latex.includes('{') && latex.includes('}');
    }

    if (token.type === 'environment') {
      const envName = token.name || '';
      return latex.includes(`\\begin{${envName}}`) && latex.includes(`\\end{${envName}}`);
    }

    if (token.type === 'command' || token.type === 'editable_command') {
      if (!latex.includes('{') || !latex.includes('}')) {
        return false;
      }

      let braceCount = 0;
      for (let i = 0; i < latex.length; i++) {
        if (latex[i] === '{') braceCount++;
        if (latex[i] === '}') braceCount--;
      }
      return braceCount === 0;
    }

    if (token.type === 'math_inline') {
      if (!latex.startsWith('$') || !latex.endsWith('$') || latex.length < 3) {
        return false;
      }
      if (latex === '$' || latex.includes('$$')) {
        return false;
      }
      const dollarCount = (latex.match(/\$/g) || []).length;
      return dollarCount === 2;
    }

    if (token.type === 'math_display') {
      if (!latex.startsWith('$$') || !latex.endsWith('$$') || latex.length < 5) {
        return false;
      }
      if (latex === '$$') {
        return false;
      }
      const content = latex.slice(2, -2);
      return !content.includes('$$');

    }

    return true;
  }
}