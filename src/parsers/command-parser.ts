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

    // Check for complete color commands first
    if (latex.startsWith('\\textcolor', position) || latex.startsWith('\\colorbox', position)) {
      const colorResult = this.parseColorCommand(latex, position);
      if (colorResult && colorResult.end > position) {
        return colorResult;
      }
    }

    // Try to extract a complete command with braces
    const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, position);

    // If we don't have a complete command, treat it as text
    if (!cmdResult || cmdResult.end <= position) {
      // For incomplete commands like '\b', '\begin', etc., just return as text
      const match = /^\\[a-zA-Z*]*/.exec(latex.slice(position));
      if (match) {
        return {
          type: 'text',
          content: match[0],
          latex: match[0],
          start: position,
          end: position + match[0].length,
        };
      }

      // Single backslash or backslash with non-letter
      return {
        type: 'text',
        content: latex.charAt(position),
        latex: latex.charAt(position),
        start: position,
        end: position + 1
      };
    }

    // We have a complete command, check if it's known
    const isKnown = EDITABLE_COMMANDS.has(cmdResult.name) ||
                   cmdResult.name === 'textcolor' ||
                   cmdResult.name === 'colorbox' ||
                   cmdResult.name === 'color';

    const token: LatexToken = {
      type: isKnown ? 'editable_command' : 'command',
      content: cmdResult.params,
      latex: cmdResult.fullCommand,
      start: position,
      end: cmdResult.end,
      name: cmdResult.name,
      params: '',
      colorArg: cmdResult.name === 'color' ? cmdResult.params : undefined
    };

    return token;
  }

  private parseColorCommand(latex: string, start: number): LatexToken | null {
    const isTextColor = latex.startsWith('\\textcolor', start);
    const isColorBox = latex.startsWith('\\colorbox', start);

    if (!isTextColor && !isColorBox) return null;

    let pos = start + (isTextColor ? 10 : 9);

    // Skip whitespace
    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    // Must have first brace
    if (pos >= latex.length || latex.charAt(pos) !== '{') {
      return {
        type: 'text',
        content: latex.slice(start, pos),
        latex: latex.slice(start, pos),
        start,
        end: pos || start + 1
      };
    }

    const colorResult = BaseLatexParser.extractBalancedBraces(latex, pos);
    if (!colorResult) {
      return {
        type: 'text',
        content: latex.slice(start, pos + 1),
        latex: latex.slice(start, pos + 1),
        start,
        end: pos + 1
      };
    }

    pos = colorResult.end;

    // Skip whitespace
    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    // Must have second brace
    if (pos >= latex.length || latex.charAt(pos) !== '{') {
      return {
        type: 'text',
        content: latex.slice(start, pos),
        latex: latex.slice(start, pos),
        start,
        end: pos || colorResult.end
      };
    }

    const contentResult = BaseLatexParser.extractBalancedBraces(latex, pos);
    if (!contentResult) {
      return {
        type: 'text',
        content: latex.slice(start, pos + 1),
        latex: latex.slice(start, pos + 1),
        start,
        end: pos + 1
      };
    }

    // Only return a command token if we have a complete color command
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