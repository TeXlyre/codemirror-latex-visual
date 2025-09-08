// src/parsers/main-parser.ts (Phase 2 Refactored)
import { LatexToken, BaseLatexParser } from './base-parser';
import { CommentParser } from './comment-parser';
import { MathParser } from './math-parser';
import { SectionParser } from './section-parser';
import { EnvironmentParser } from './environment-parser';
import { CommandParser } from './command-parser';
import { TableParser } from './table-parser';
import { errorService, ErrorCategory, ErrorSeverity } from '../core/error-service';

export class LatexTokenizer {
  private static instance: LatexTokenizer;
  private parsers: BaseLatexParser[];
  public maxDepth: number = 10;
  private currentDepth: number = 0;

  constructor() {
    this.parsers = [
      new CommentParser(),
      new MathParser(),
      new SectionParser(),
      new TableParser(),
      new EnvironmentParser(),
      new CommandParser(),
    ];
  }

  static getInstance(): LatexTokenizer {
    if (!LatexTokenizer.instance) {
      LatexTokenizer.instance = new LatexTokenizer();
    }
    return LatexTokenizer.instance;
  }

  getMaxDepth(): number {
    return this.maxDepth;
  }

  setMaxDepth(depth: number): void {
    this.maxDepth = depth;
  }

  tokenize(latex: string): LatexToken[] {
    if (this.currentDepth > this.maxDepth) {
      errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.WARN,
        'Maximum tokenizer depth exceeded',
        { depth: this.currentDepth, maxDepth: this.maxDepth }
      );
      return [{
        type: 'text',
        content: latex,
        latex: latex,
        start: 0,
        end: latex.length
      }];
    }

    this.currentDepth++;

    try {
      const result = this.tokenizeInternal(latex);
      this.currentDepth--;
      return result;
    } catch (error) {
      this.currentDepth--;

      const latexError = errorService.logError(
        ErrorCategory.PARSER,
        ErrorSeverity.ERROR,
        'Tokenization failed with error',
        { error, contentLength: latex.length }
      );

      const recovered = errorService.tryRecover<LatexToken>(latexError, {
        content: latex,
        start: 0,
        end: latex.length
      });

      if (recovered) {
        return [recovered];
      }

      return [{
        type: 'text',
        content: latex,
        latex: latex,
        start: 0,
        end: latex.length
      }];
    }
  }

  private tokenizeInternal(latex: string): LatexToken[] {
    const tokens: LatexToken[] = [];
    let pos = 0;
    let iterations = 0;
    const maxIterations = latex.length * 2 + 1000;

    while (pos < latex.length) {
      iterations++;

      if (iterations > maxIterations) {
        errorService.logError(
          ErrorCategory.PARSER,
          ErrorSeverity.ERROR,
          'Iteration limit reached, preventing infinite loop',
          { position: pos, iterations, maxIterations }
        );

        const remaining = latex.slice(pos);
        if (remaining) {
          tokens.push({
            type: 'text',
            content: remaining,
            latex: remaining,
            start: pos,
            end: latex.length
          });
        }
        break;
      }

      const startPos = pos;
      let parsed = false;

      try {
        parsed = this.tryParseParagraphBreak(latex, pos, tokens) ||
                this.tryParseWithParsers(latex, pos, tokens);

        if (!parsed) {
          this.parseTextSegment(latex, pos, tokens);
          parsed = true;
        }

        pos = this.getLastTokenEnd(tokens, startPos);

      } catch (error) {
        errorService.logError(
          ErrorCategory.PARSER,
          ErrorSeverity.WARN,
          'Parser error at position, advancing',
          { position: pos, error }
        );

        tokens.push({
          type: 'text',
          content: latex.charAt(pos),
          latex: latex.charAt(pos),
          start: pos,
          end: pos + 1
        });
        pos++;
      }

      if (pos <= startPos) {
        errorService.logError(
          ErrorCategory.PARSER,
          ErrorSeverity.WARN,
          'Parser stuck, forcing advance',
          { position: pos, startPos }
        );

        tokens.push({
          type: 'text',
          content: latex.charAt(pos),
          latex: latex.charAt(pos),
          start: pos,
          end: pos + 1
        });
        pos++;
      }
    }

    return this.postProcessTokens(tokens);
  }

  private tryParseParagraphBreak(latex: string, pos: number, tokens: LatexToken[]): boolean {
    const paragraphBreakMatch = latex.slice(pos).match(/^(\n{2,})/);
    if (paragraphBreakMatch) {
      tokens.push({
        type: 'paragraph_break',
        content: paragraphBreakMatch[1],
        latex: paragraphBreakMatch[1],
        start: pos,
        end: pos + paragraphBreakMatch[1].length
      });
      return true;
    }
    return false;
  }

  private tryParseWithParsers(latex: string, pos: number, tokens: LatexToken[]): boolean {
    for (const parser of this.parsers) {
      try {
        if (parser.canParse(latex, pos)) {
          const token = parser.parse(latex, pos);

          if (token && this.isValidToken(token, pos, latex.length)) {
            if (this.isCompleteConstruct(token)) {
              tokens.push(token);
              return true;
            }
          }
        }
      } catch (error) {
        errorService.logError(
          ErrorCategory.PARSER,
          ErrorSeverity.WARN,
          `Parser ${parser.constructor.name} failed`,
          { position: pos, error }
        );
      }
    }
    return false;
  }

  private parseTextSegment(latex: string, pos: number, tokens: LatexToken[]): void {
    let textStart = pos;
    let textEnd = pos;

    while (textEnd < latex.length) {
      const char = latex.charAt(textEnd);

      if (latex.startsWith('\n\n', textEnd)) break;
      if (this.isSpecialCharacter(char, latex, textEnd)) break;

      textEnd++;
    }

    if (textEnd > textStart) {
      const textContent = latex.slice(textStart, textEnd);
      tokens.push({
        type: 'text',
        content: textContent,
        latex: textContent,
        start: textStart,
        end: textEnd
      });
    } else {
      const char = latex.charAt(pos);
      tokens.push({
        type: 'text',
        content: char,
        latex: char,
        start: pos,
        end: pos + 1
      });
    }
  }

  private isSpecialCharacter(char: string, latex: string, pos: number): boolean {
    if (char === '\\' || char === '$' || char === '%') return true;
    if (latex.startsWith('\\begin{', pos)) return true;
    return false;
  }

  private isValidToken(token: LatexToken, pos: number, maxLength: number): boolean {
    return token.end > pos &&
           token.end <= maxLength &&
           token.start >= 0 &&
           token.start < token.end;
  }

  private isCompleteConstruct(token: LatexToken): boolean {
    const latex = token.latex;

    try {
      switch (token.type) {
        case 'command':
        case 'editable_command':
          if (latex.startsWith('\\') && !latex.includes('{')) return false;
          if (latex.includes('{') && !latex.includes('}')) return false;
          let braceCount = 0;
          for (let i = 0; i < latex.length; i++) {
            if (latex[i] === '{') braceCount++;
            if (latex[i] === '}') braceCount--;
          }
          return braceCount === 0;

        case 'environment':
          const envName = token.name || '';
          return latex.includes(`\\begin{${envName}}`) && latex.includes(`\\end{${envName}}`);

        case 'section':
          return latex.includes('{') && latex.includes('}');

        case 'math_inline':
          if (!latex.startsWith('$') || !latex.endsWith('$') || latex.length < 3) return false;
          if (latex === '$') return false;
          // Check that it's not actually display math ($$...$$)
          if (latex.startsWith('$$') || latex.endsWith('$$')) return false;
          const dollarCount = (latex.match(/\$/g) || []).length;
          return dollarCount === 2;

        case 'math_display':
          if (!latex.startsWith('$$') || !latex.endsWith('$$') || latex.length < 5) return false;
          if (latex === '$$') return false;
          const content = latex.slice(2, -2);
          // Content shouldn't contain unescaped $$
          return !content.includes('$$');

        default:
          return true;
      }
    } catch (error) {
      errorService.logError(
        ErrorCategory.RENDER,
        ErrorSeverity.WARN,
        'Error validating construct completeness',
        { tokenType: token.type, latex: latex.substring(0, 50), error }
      );
      return false;
    }
  }

  private getLastTokenEnd(tokens: LatexToken[], fallback: number): number {
    const lastToken = tokens[tokens.length - 1];
    return lastToken ? lastToken.end : fallback + 1;
  }

  private postProcessTokens(tokens: LatexToken[]): LatexToken[] {
    return tokens.filter(token => token.latex.length > 0);
  }
}