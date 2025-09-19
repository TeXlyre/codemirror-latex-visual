// src/parsers/base-parser.ts
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export interface LatexToken {
  type: 'text' | 'math_inline' | 'math_display' | 'section' | 'environment' | 'command' | 'comment' | 'paragraph_break' | 'mixed_paragraph' | 'editable_command' | 'unknown_command' | 'table';
  content: string;
  latex: string;
  start: number;
  end: number;
  id?: string; // Add unique identifier for tracking
  level?: number;
  name?: string;
  params?: string;
  colorArg?: string;
  children?: LatexToken[];
  elements?: Array<{
    type: 'text' | 'command' | 'math_inline' | 'editable_command';
    content: string | LatexToken[];
    latex: string;
    name?: string;
    colorArg?: string;
  }>;
}

export interface ParseResult {
  content: string;
  end: number;
}

export interface CommandParseResult extends ParseResult {
  name: string;
  params: string;
  fullCommand: string;
}

export interface ValidationResult {
  isComplete: boolean;
  isValid: boolean;
  errors: string[];
}

export abstract class BaseLatexParser {
  protected static extractBalancedBraces(latex: string, start: number): { content: string; end: number } | null {
    if (latex.charAt(start) !== '{') return null;

    let pos = start + 1;
    let braceCount = 1;
    let escaped = false;

    while (pos < latex.length && braceCount > 0) {
      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }

      if (latex.charAt(pos) === '\\') {
        escaped = true;
        pos++;
        continue;
      }

      if (latex.charAt(pos) === '{') {
        braceCount++;
      } else if (latex.charAt(pos) === '}') {
        braceCount--;
      }

      pos++;
    }

    if (braceCount === 0) {
      return {
        content: latex.slice(start + 1, pos - 1),
        end: pos
      };
    }

    return null;
  }

  protected static extractCommandWithBraces(latex: string, start: number): CommandParseResult | null {
    const cmdMatch = latex.slice(start).match(/^\\([a-zA-Z*]+)/);
    if (!cmdMatch) return null;

    const name = cmdMatch[1];
    let pos = start + cmdMatch[0].length;
    let params = '';
    let fullCommand = cmdMatch[0];

    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    if (pos < latex.length && latex.charAt(pos) === '{') {
      const braceResult = this.extractBalancedBraces(latex, pos);
      if (braceResult) {
        params = braceResult.content;
        fullCommand = latex.slice(start, braceResult.end);
      }
    }

    return { name, params, fullCommand, content: params, end: start + fullCommand.length };
  }

  protected validateToken(token: LatexToken): ValidationResult {
    const errors: string[] = [];
    let isComplete = true;
    let isValid = true;

    try {
      switch (token.type) {
        case 'command':
        case 'editable_command':
          if (!token.latex.includes('{') || !token.latex.includes('}')) {
            isComplete = false;
            errors.push('Incomplete command braces');
          }
          break;

        case 'environment':
          if (!token.name) {
            isValid = false;
            errors.push('Environment missing name');
          } else if (!token.latex.includes(`\\begin{${token.name}}`) || !token.latex.includes(`\\end{${token.name}}`)) {
            isComplete = false;
            errors.push('Incomplete environment tags');
          }
          break;

        case 'math_inline':
          if (!token.latex.startsWith('$') || !token.latex.endsWith('$') || token.latex.length < 3) {
            isComplete = false;
            errors.push('Incomplete inline math delimiters');
          }
          break;

        case 'math_display':
          if (!token.latex.startsWith('$$') || !token.latex.endsWith('$$') || token.latex.length < 5) {
            isComplete = false;
            errors.push('Incomplete display math delimiters');
          }
          break;

        case 'section':
          if (!token.latex.includes('{') || !token.latex.includes('}')) {
            isComplete = false;
            errors.push('Incomplete section braces');
          }
          break;
      }

    } catch (error) {
      isValid = false;
      errors.push(`Validation error: ${error}`);
    }

    return { isComplete, isValid, errors };
  }

  protected createFallbackToken(content: string, start: number): LatexToken {
    return {
      type: 'text',
      content,
      latex: content,
      start,
      end: start + content.length
    };
  }

  protected handleParseError(error: any, content: string, position: number): LatexToken {
    const latexError = errorService.logError(
      ErrorCategory.PARSER,
      ErrorSeverity.ERROR,
      `Failed to parse ${this.constructor.name}`,
      { content: content.substring(0, 100), position, error }
    );

    const recovered = errorService.tryRecover<LatexToken>(latexError, { content, position });
    return recovered || this.createFallbackToken(content.charAt(position), position);
  }

  protected logValidationWarning(token: LatexToken, validation: ValidationResult): void {
    if (!validation.isComplete || !validation.isValid) {
      errorService.logError(
        ErrorCategory.PARSER,
        validation.isValid ? ErrorSeverity.WARN : ErrorSeverity.ERROR,
        `Token validation failed for ${token.type}`,
        {
          token: { type: token.type, latex: token.latex.substring(0, 50) },
          validation
        }
      );
    }
  }

  abstract canParse(latex: string, position: number): boolean;
  abstract parse(latex: string, position: number): LatexToken | null;
}