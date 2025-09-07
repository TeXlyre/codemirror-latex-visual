import { BaseLatexParser, LatexToken } from './base-parser';
import { LatexTokenizer } from './main-parser';

export class EnvironmentParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.startsWith('\\begin{', position);
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    const beginMatch = latex.slice(position).match(/^\\begin\{([^}]+)\}/);
    if (!beginMatch) {
      const incompleteMatch = latex.slice(position).match(/^\\begin(\{[^}]*)?$/);
      if (incompleteMatch) {
        return {
          type: 'text',
          content: incompleteMatch[0],
          latex: incompleteMatch[0],
          start: position,
          end: position + incompleteMatch[0].length
        };
      }
      return this.parseAsCommand(latex, position);
    }

    const envName = beginMatch[1];
    const endPos = this.findMatchingEnd(latex, position, envName);

    if (endPos === -1) {
      return {
        type: 'text',
        content: latex.slice(position),
        latex: latex.slice(position),
        start: position,
        end: latex.length
      };
    }

    const endPattern = `\\end{${envName}}`;
    const fullLatex = latex.slice(position, endPos + endPattern.length);
    const content = latex.slice(position + beginMatch[0].length, endPos);

    const token: LatexToken = {
      type: 'environment',
      content,
      latex: fullLatex,
      start: position,
      end: endPos + endPattern.length,
      name: envName
    };

    if (content.trim() && envName !== 'tabular') {
      token.children = this.parseNestedContent(content);
    }

    return token;
  }

  private findMatchingEnd(latex: string, startPos: number, envName: string): number {
    const beginPattern = `\\begin{${envName}}`;
    const endPattern = `\\end{${envName}}`;

    let pos = startPos + beginPattern.length;
    let depth = 1;

    while (pos < latex.length && depth > 0) {
      const nextBegin = latex.indexOf(beginPattern, pos);
      const nextEnd = latex.indexOf(endPattern, pos);

      if (nextEnd === -1) {
        return -1;
      }

      if (nextBegin !== -1 && nextBegin < nextEnd) {
        depth++;
        pos = nextBegin + beginPattern.length;
      } else {
        depth--;
        if (depth === 0) {
          return nextEnd;
        }
        pos = nextEnd + endPattern.length;
      }
    }

    return -1;
  }

  private parseNestedContent(content: string): LatexToken[] {
    const tokenizer = new LatexTokenizer();
    return tokenizer.tokenize(content);
  }

  private parseAsCommand(latex: string, position: number): LatexToken {
    const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, position);
    if (!cmdResult) {
      return {
        type: 'text',
        content: latex.charAt(position),
        latex: latex.charAt(position),
        start: position,
        end: position + 1
      };
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
  }
}