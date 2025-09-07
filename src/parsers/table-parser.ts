import { BaseLatexParser, LatexToken } from './base-parser';
import { LatexTokenizer } from './main-parser';

export class TableParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.startsWith('\\begin{tabular}', position) ||
        latex.startsWith('\\begin{table}', position);
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    const isTable = latex.startsWith('\\begin{table}', position);
    const envName = isTable ? 'table' : 'tabular';

    const beginMatch = latex.slice(position).match(
        isTable ? /^\\begin\{table\}(\[.*?\])?/ : /^\\begin\{tabular\}(\[.*?\])?\{([^}]+)\}/
    );

    if (!beginMatch) {
      const incompleteMatch = latex.slice(position).match(
        isTable ? /^\\begin\{table\}(\[.*?)?$/ : /^\\begin\{tabular\}(\[.*?\])?(\{[^}]*)?$/
      );
      if (incompleteMatch) {
        return {
          type: 'text',
          content: incompleteMatch[0],
          latex: incompleteMatch[0],
          start: position,
          end: position + incompleteMatch[0].length
        };
      }
      return null;
    }

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
    const rawContent = latex.slice(position + beginMatch[0].length, endPos);
    const content = rawContent.replace(/^\s*\n|\n\s*$/g, '');
    const alignment = isTable ? '' : (beginMatch[2] || '');

    const token: LatexToken = {
      type: 'environment',
      content,
      latex: fullLatex,
      start: position,
      end: endPos + endPattern.length,
      name: envName,
      params: alignment
    };

    if (content.trim() && envName === 'tabular') {
      token.children = this.parseTableContent(content);
    }

    return token;
  }

  private parseTableContent(content: string): LatexToken[] {
    if (!content.trim()) return [];

    const rows = content.split('\\\\').map(row => row.trim()).filter(row => row);
    const tokens: LatexToken[] = [];

    rows.forEach((rowContent, rowIndex) => {
      if (rowContent) {
        const cells = rowContent.split('&').map(cell => cell.trim());
        cells.forEach((cellContent, cellIndex) => {
          if (cellContent) {
            const tokenizer = new LatexTokenizer();
            const cellTokens = tokenizer.tokenize(cellContent);
            tokens.push(...cellTokens);
          }
        });
      }
    });

    return tokens;
  }
}