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

  tokenize(latex: string): LatexToken[] {
    const tokens: LatexToken[] = [];
    let pos = 0;

    while (pos < latex.length) {
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

      // Try all parsers
      let parsed = false;
      for (const parser of this.parsers) {
        if (parser.canParse(latex, pos)) {
          const token = parser.parse(latex, pos);
          if (token) {
            tokens.push(token);
            pos = token.end;
            parsed = true;
            break;
          }
        }
      }

      // If no parser handled it, collect as text
      if (!parsed) {
        let textStart = pos;
        let textEnd = pos;

        // Collect consecutive characters that aren't special LaTeX syntax
        while (textEnd < latex.length) {
          // Stop at paragraph breaks
          if (latex.startsWith('\n\n', textEnd)) {
            break;
          }

          // Stop at LaTeX commands, math, environments, comments
          if (latex.charAt(textEnd) === '\\' ||
              latex.charAt(textEnd) === '$' ||
              latex.charAt(textEnd) === '%' ||
              latex.startsWith('\\begin{', textEnd)) {
            break;
          }

          textEnd++;
        }

        // Create a single text token for the entire sequence
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
          // Fallback: single character
          pos++;
        }
      }
    }

    return tokens;
  }
}