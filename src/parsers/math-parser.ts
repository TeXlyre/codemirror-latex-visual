import { BaseLatexParser, LatexToken } from './base-parser';

export class MathParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.charAt(position) === '$';
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    // Determine if this is $$ or just $
    const isDisplayMath = latex.charAt(position + 1) === '$';

    if (isDisplayMath) {
      return this.parseDisplayMath(latex, position);
    } else {
      return this.parseInlineMath(latex, position);
    }
  }

  private parseDisplayMath(latex: string, start: number): LatexToken {
    // We start with $$ at position start
    let pos = start + 2; // Skip opening $$
    let escaped = false;

    // Scan character by character looking for closing $$
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

      // Check for closing $$
      if (char === '$' && latex.charAt(pos + 1) === '$') {
        // Found closing $$
        const content = latex.slice(start + 2, pos);

        if (content.length > 0) {
          // Valid display math
          return {
            type: 'math_display',
            content: content,
            latex: latex.slice(start, pos + 2),
            start: start,
            end: pos + 2
          };
        } else {
          // Empty $$$$, treat as text
          break;
        }
      }

      pos++;
    }

    // No closing $$ found or empty content
    return {
      type: 'text',
      content: '$$',
      latex: '$$',
      start: start,
      end: start + 2
    };
  }

  private parseInlineMath(latex: string, start: number): LatexToken {
    // We start with $ at position start
    let pos = start + 1; // Skip opening $
    let escaped = false;

    // Scan character by character looking for closing $
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

      // Check for $
      if (char === '$') {
        // Make sure this isn't the start of $$
        if (pos + 1 < latex.length && latex.charAt(pos + 1) === '$') {
          // This is $$, which means our $ doesn't have a proper closing
          break;
        }

        // Found closing $
        const content = latex.slice(start + 1, pos);

        if (content.length > 0) {
          // Valid inline math
          return {
            type: 'math_inline',
            content: content,
            latex: latex.slice(start, pos + 1),
            start: start,
            end: pos + 1
          };
        } else {
          // Empty $$, treat as text
          break;
        }
      }

      pos++;
    }

    // No closing $ found or empty content
    return {
      type: 'text',
      content: '$',
      latex: '$',
      start: start,
      end: start + 1
    };
  }
}