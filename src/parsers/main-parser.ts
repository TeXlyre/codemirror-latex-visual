import { LatexToken } from './base-parser';
import { CommentParser } from './comment-parser';
import { MathParser } from './math-parser';
import { SectionParser } from './section-parser';
import { EnvironmentParser } from './environment-parser';
import { CommandParser } from './command-parser';
import { TableParser } from './table-parser';

export class LatexTokenizer {
  private parsers = [
    new CommentParser(),
    new MathParser(),
    new SectionParser(),
    new TableParser(),
    new EnvironmentParser(),
    new CommandParser(),
  ];

  private depth = 0;
  private maxDepth = 10;

  tokenize(latex: string): LatexToken[] {
    if (this.depth > this.maxDepth) {
      console.warn('Maximum tokenizer depth exceeded, returning text token');
      return [{
        type: 'text',
        content: latex,
        latex: latex,
        start: 0,
        end: latex.length
      }];
    }

    this.depth++;
    const result = this.tokenizeInternal(latex);
    this.depth--;
    return result;
  }

  private tokenizeInternal(latex: string): LatexToken[] {
    const tokens: LatexToken[] = [];
    let pos = 0;
    let iterations = 0;
    const maxIterations = latex.length * 2 + 1000;

    while (pos < latex.length) {
      iterations++;
      if (iterations > maxIterations) {
        console.warn('Tokenizer iteration limit reached, breaking to prevent infinite loop');
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

      // Handle paragraph breaks first
      const paragraphBreakMatch = latex.slice(pos).match(/^(\n{2,})/);
      if (paragraphBreakMatch) {
        tokens.push({
          type: 'paragraph_break',
          content: paragraphBreakMatch[1],
          latex: paragraphBreakMatch[1],
          start: pos,
          end: pos + paragraphBreakMatch[1].length
        });
        pos += paragraphBreakMatch[1].length;
        continue;
      }

      let parsed = false;
      for (const parser of this.parsers) {
        if (parser.canParse(latex, pos)) {
          const token = parser.parse(latex, pos);
          if (token && token.end > pos && token.end <= latex.length) {
            // Additional validation for math tokens
            if ((token.type === 'math_inline' || token.type === 'math_display') &&
                token.latex.length < 3) {
              // Too short to be valid math, treat as text
              tokens.push({
                type: 'text',
                content: latex.charAt(pos),
                latex: latex.charAt(pos),
                start: pos,
                end: pos + 1
              });
              pos++;
              parsed = true;
              break;
            }

            tokens.push(token);
            pos = token.end;
            parsed = true;
            break;
          }
        }
      }

      if (!parsed) {
        // Collect consecutive non-special characters
        let textStart = pos;
        let textEnd = pos;

        while (textEnd < latex.length) {
          const char = latex.charAt(textEnd);

          // Stop at paragraph breaks
          if (latex.startsWith('\n\n', textEnd)) {
            break;
          }

          // Stop at potential LaTeX syntax
          if (char === '\\' || char === '$' || char === '%' ||
              latex.startsWith('\\begin{', textEnd)) {
            break;
          }

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
          pos = textEnd;
        } else {
          // Single character fallback
          const char = latex.charAt(pos);
          tokens.push({
            type: 'text',
            content: char,
            latex: char,
            start: pos,
            end: pos + 1
          });
          pos++;
        }
      }

      // Safety check to prevent infinite loops
      if (pos <= startPos) {
        console.warn(`Parser stuck at position ${pos}, forcing advance`);
        const char = latex.charAt(pos);
        tokens.push({
          type: 'text',
          content: char,
          latex: char,
          start: pos,
          end: pos + 1
        });
        pos++;
      }
    }

    return tokens;
  }
}