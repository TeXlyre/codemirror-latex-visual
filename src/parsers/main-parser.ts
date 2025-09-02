import { LatexToken } from './base-parser';
import { CommentParser } from './comment-parser';
import { MathParser } from './math-parser';
import { SectionParser } from './section-parser';
import { EnvironmentParser } from './environment-parser';
import { CommandParser } from './command-parser';
import { ParagraphParser } from './paragraph-parser';

export class LatexTokenizer {
  private parsers = [
    new CommentParser(),
    new MathParser(),
    new SectionParser(),
    new EnvironmentParser(),
    new CommandParser(),
    new ParagraphParser()
  ];

  tokenize(latex: string): LatexToken[] {
    const tokens: LatexToken[] = [];
    let pos = 0;

    while (pos < latex.length) {
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
          if (token) {
            tokens.push(token);
            pos = token.end;
            parsed = true;
            break;
          }
        }
      }

      if (!parsed) {
        pos++;
      }
    }

    return tokens;
  }
}