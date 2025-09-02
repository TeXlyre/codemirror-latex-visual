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
      return this.parseAsCommand(latex, position);
    }

    const envName = beginMatch[1];
    const endPattern = `\\end{${envName}}`;
    const endPos = latex.indexOf(endPattern, position + beginMatch[0].length);

    if (endPos === -1) {
      return {
        type: 'text',
        content: latex.slice(position),
        latex: latex.slice(position),
        start: position,
        end: latex.length
      };
    }

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