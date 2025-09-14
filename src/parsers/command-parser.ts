// src/parsers/command-parser.ts
import { BaseLatexParser, LatexToken } from './base-parser';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

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

    try {
      if (latex.startsWith('\\textcolor', position) || latex.startsWith('\\colorbox', position)) {
        const colorResult = this.parseColorCommand(latex, position);
        if (colorResult && colorResult.end > position) {
          const validation = this.validateToken(colorResult);
          if (!validation.isComplete || !validation.isValid) {
            this.logValidationWarning(colorResult, validation);
          }
          return colorResult;
        }
      }

      const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, position);

      if (!cmdResult || cmdResult.end <= position) {
        return this.handleIncompleteCommand(latex, position);
      }

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

      const validation = this.validateToken(token);
      if (!validation.isComplete || !validation.isValid) {
        this.logValidationWarning(token, validation);
      }

      return token;

    } catch (error) {
      return this.handleParseError(error, latex, position);
    }
  }

  private handleIncompleteCommand(latex: string, position: number): LatexToken {
    const match = /^\\[a-zA-Z*]*/.exec(latex.slice(position));
    if (match) {
      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.WARN,
        'Incomplete command found',
        { command: match[0], position }
      );

      return this.createFallbackToken(match[0], position);
    }

    return this.createFallbackToken(latex.charAt(position), position);
  }

  private parseColorCommand(latex: string, start: number): LatexToken | null {
    try {
      const isTextColor = latex.startsWith('\\textcolor', start);
      const isColorBox = latex.startsWith('\\colorbox', start);

      if (!isTextColor && !isColorBox) return null;

      let pos = start + (isTextColor ? 10 : 9);

      while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
        pos++;
      }

      if (pos >= latex.length || latex.charAt(pos) !== '{') {
        return this.createFallbackToken(latex.slice(start, pos), start);
      }

      const colorResult = BaseLatexParser.extractBalancedBraces(latex, pos);
      if (!colorResult) {
        return this.createFallbackToken(latex.slice(start, pos + 1), start);
      }

      pos = colorResult.end;

      while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
        pos++;
      }

      if (pos >= latex.length || latex.charAt(pos) !== '{') {
        return this.createFallbackToken(latex.slice(start, pos), start);
      }

      const contentResult = BaseLatexParser.extractBalancedBraces(latex, pos);
      if (!contentResult) {
        return this.createFallbackToken(latex.slice(start, pos + 1), start);
      }

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

    } catch (error) {
      return this.handleParseError(error, latex, start);
    }
  }
}