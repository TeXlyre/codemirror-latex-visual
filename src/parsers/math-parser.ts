// src/parsers/math-parser.ts
import { BaseLatexParser, LatexToken } from './base-parser';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export class MathParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.charAt(position) === '$';
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    try {
      const isDisplayMath = latex.charAt(position + 1) === '$';

      if (isDisplayMath) {
        return this.parseDisplayMath(latex, position);
      } else {
        return this.parseInlineMath(latex, position);
      }
    } catch (error) {
      return this.handleParseError(error, latex, position);
    }
  }

  private parseDisplayMath(latex: string, start: number): LatexToken {
    try {
      let pos = start + 2;
      let escaped = false;

      while (pos < latex.length - 1) {
        const char = latex.charAt(pos);

        if (escaped) {
          escaped = false;
          pos++;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          pos++;
          continue;
        }

        if (char === '$' && latex.charAt(pos + 1) === '$') {
          const content = latex.slice(start + 2, pos);

          if (content.length > 0) {
            const token: LatexToken = {
              type: 'math_display',
              content: content,
              latex: latex.slice(start, pos + 2),
              start: start,
              end: pos + 2
            };

            const validation = this.validateToken(token);
            if (!validation.isComplete || !validation.isValid) {
              this.logValidationWarning(token, validation);
            }

            return token;
          } else {
            errorService.logError(
              ErrorCategory.PARSER,
              ErrorSeverity.WARN,
              'Empty display math content found',
              { position: start, latex: '$$$$' }
            );
            break;
          }
        }

        pos++;
      }

      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.WARN,
        'Incomplete display math construct',
        { position: start, foundClosing: false }
      );

      return this.createFallbackToken('$$', start);

    } catch (error) {
      return this.handleParseError(error, latex, start);
    }
  }

  private parseInlineMath(latex: string, start: number): LatexToken {
    try {
      let pos = start + 1;
      let escaped = false;

      while (pos < latex.length) {
        const char = latex.charAt(pos);

        if (escaped) {
          escaped = false;
          pos++;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          pos++;
          continue;
        }

        if (char === '$') {
          // Check if this is the start of display math ($$) that would invalidate our inline math
          if (pos + 1 < latex.length && latex.charAt(pos + 1) === '$') {
            // We found $$, which means our inline math is incomplete
            errorService.logError(
              ErrorCategory.PARSER,
              ErrorSeverity.WARN,
              'Inline math terminated by display math delimiter',
              { position: start, terminatorPosition: pos }
            );
            break;
          }

          // This is a valid closing $ for inline math
          const content = latex.slice(start + 1, pos);

          if (content.length > 0) {
            const token: LatexToken = {
              type: 'math_inline',
              content: content,
              latex: latex.slice(start, pos + 1),
              start: start,
              end: pos + 1
            };

            const validation = this.validateToken(token);
            if (!validation.isComplete || !validation.isValid) {
              this.logValidationWarning(token, validation);
            }

            return token;
          } else {
            errorService.logError(
              ErrorCategory.PARSER,
              ErrorSeverity.WARN,
              'Empty inline math content found',
              { position: start }
            );
            break;
          }
        }

        pos++;
      }

      // If we get here, we didn't find a closing $
      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.WARN,
        'Incomplete inline math construct - no closing delimiter found',
        { position: start, searchedUntil: pos }
      );

      return this.createFallbackToken('$', start);

    } catch (error) {
      return this.handleParseError(error, latex, start);
    }
  }
}