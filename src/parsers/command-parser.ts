import { BaseLatexParser, LatexToken } from './base-parser';

export const EDITABLE_COMMANDS = new Set([
  'textbf', 'textit', 'emph', 'underline', 'textsc', 'textsf', 'texttt',
  'section', 'subsection', 'subsubsection', 'title', 'author', 'date',
  'footnote', 'cite', 'ref', 'label', 'url', 'href'
]);

export const FORMATTING_COMMANDS = new Map([
  ['textbf', 'strong'],
  ['textit', 'em'],
  ['emph', 'em']
]);

export class CommandParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.charAt(position) === '\\';
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, position);
    if (!cmdResult) {
      return {
        type: 'text',
        content: latex.charAt(position),
        latex: latex.charAt(position),
        start: position,
        end: position + 1
      };
    }

    const isEditable = EDITABLE_COMMANDS.has(cmdResult.name);

    return {
      type: isEditable ? 'editable_command' : 'command',
      content: cmdResult.params,
      latex: cmdResult.fullCommand,
      start: position,
      end: cmdResult.end,
      name: cmdResult.name,
      params: ''
    };
  }
}