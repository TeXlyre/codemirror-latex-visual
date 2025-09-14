// src/parsers/section-parser.ts
import { BaseLatexParser, LatexToken } from './base-parser';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export class SectionParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.startsWith('\\section', position) ||
           latex.startsWith('\\subsection', position) ||
           latex.startsWith('\\subsubsection', position);
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    try {
      const match = latex.slice(position).match(/^(\\(?:sub)*section\*?)\{([^}]*)\}/);

      if (!match) {
        const incompleteMatch = latex.slice(position).match(/^(\\(?:sub)*section\*?)(\{[^}]*)?$/);
        if (incompleteMatch) {
          errorService.logError(
            ErrorCategory.PARSER,
            ErrorSeverity.WARN,
            'Incomplete section construct found',
            { match: incompleteMatch[0], position }
          );

          return this.createFallbackToken(incompleteMatch[0], position);
        }
        return this.parseAsCommand(latex, position);
      }

      const level = this.getSectionLevel(match[1]);
      const title = match[2];

      const token: LatexToken = {
        type: 'section',
        content: title,
        latex: match[0],
        start: position,
        end: position + match[0].length,
        level,
        name: match[1].substring(1)
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

  private getSectionLevel(sectionCommand: string): number {
    if (sectionCommand.includes('subsubsection')) return 3;
    if (sectionCommand.includes('subsection')) return 2;
    return 1;
  }

  private parseAsCommand(latex: string, position: number): LatexToken {
    try {
      const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, position);
      if (!cmdResult) {
        return this.createFallbackToken(latex.charAt(position), position);
      }

      return {
        type: 'command',
        content: cmdResult.params,
        latex: cmdResult.fullCommand,
        start: position,
        end: cmdResult.end,
        name: cmdResult.name,
        params: ''
      };
    } catch (error) {
      return this.handleParseError(error, latex, position);
    }
  }
}