import { BaseLatexParser, LatexToken } from './base-parser';

export const EDITABLE_COMMANDS = new Set([
  'textbf', 'textit', 'emph', 'underline', 'textsc', 'textsf', 'texttt',
  'section', 'subsection', 'subsubsection', 'title', 'author', 'date',
  'footnote', 'cite', 'citeyear', 'citep', 'citey', 'ref', 'label', 'url', 'href',
  'textcolor', 'color', 'colorbox'
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

    if (latex.startsWith('\\textcolor', position) || latex.startsWith('\\colorbox', position)) {
      return this.parseColorCommand(latex, position);
    }

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
      params: '',
      colorArg: cmdResult.name === 'color' ? cmdResult.params : undefined
    };
  }

  private parseColorCommand(latex: string, start: number): LatexToken | null {
    const isTextColor = latex.startsWith('\\textcolor', start);
    const isColorBox = latex.startsWith('\\colorbox', start);

    if (!isTextColor && !isColorBox) return null;

    let pos = start + (isTextColor ? 10 : 9);

    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    if (latex.charAt(pos) !== '{') return null;
    const colorResult = BaseLatexParser.extractBalancedBraces(latex, pos);
    if (!colorResult) return null;

    pos = colorResult.end;

    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    if (latex.charAt(pos) !== '{') return null;
    const contentResult = BaseLatexParser.extractBalancedBraces(latex, pos);
    if (!contentResult) return null;

    const fullCommand = latex.slice(start, contentResult.end);

    return {
      type: 'editable_command',
      content: contentResult.content,
      latex: fullCommand,
      start,
      end: contentResult.end,
      name: isTextColor ? 'textcolor' : 'colorbox',
      params: contentResult.content,
      colorArg: colorResult.content
    };
  }
}