import { BaseLatexParser, LatexToken } from './base-parser';

export class MathParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.startsWith('$$', position) ||
           (latex.charAt(position) === '$' && latex.charAt(position + 1) !== '$');
  }

  parse(latex: string, position: number): LatexToken | null {
    if (latex.startsWith('$$', position)) {
      return this.parseDisplayMath(latex, position);
    }

    if (latex.charAt(position) === '$' && latex.charAt(position + 1) !== '$') {
      return this.parseInlineMath(latex, position);
    }

    return null;
  }

  private parseDisplayMath(latex: string, start: number): LatexToken {
    const end = latex.indexOf('$$', start + 2);
    if (end === -1) {
      return {
        type: 'text',
        content: latex.slice(start),
        latex: latex.slice(start),
        start,
        end: latex.length
      };
    }

    const content = latex.slice(start + 2, end);
    return {
      type: 'math_display',
      content,
      latex: latex.slice(start, end + 2),
      start,
      end: end + 2
    };
  }

  private parseInlineMath(latex: string, start: number): LatexToken {
    const end = this.findMatchingDollar(latex, start + 1);
    if (end === -1) {
      return {
        type: 'text',
        content: latex.slice(start),
        latex: latex.slice(start),
        start,
        end: latex.length
      };
    }

    const content = latex.slice(start + 1, end);
    return {
      type: 'math_inline',
      content,
      latex: latex.slice(start, end + 1),
      start,
      end: end + 1
    };
  }

  private findMatchingDollar(latex: string, start: number): number {
    let pos = start;
    let escaped = false;

    while (pos < latex.length) {
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

      if (latex.charAt(pos) === '$') {
        return pos;
      }

      pos++;
    }

    return -1;
  }
}