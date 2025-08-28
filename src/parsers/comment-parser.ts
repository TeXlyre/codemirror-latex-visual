import { BaseLatexParser, LatexToken } from './base-parser';

export class CommentParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.charAt(position) === '%';
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    let end = position + 1;
    while (end < latex.length && latex.charAt(end) !== '\n') {
      end++;
    }

    if (end < latex.length && latex.charAt(end) === '\n') {
      end++;
    }

    const fullComment = latex.slice(position, end);
    const commentContent = latex.slice(position + 1, end - (latex.charAt(end - 1) === '\n' ? 1 : 0));

    return {
      type: 'comment',
      content: commentContent,
      latex: fullComment,
      start: position,
      end
    };
  }
}