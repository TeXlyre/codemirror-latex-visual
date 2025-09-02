import { BaseLatexParser, LatexToken } from './base-parser';

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

    if (!beginMatch) return null;

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
    const content = rawContent.replace(/^\s*\n|\n\s*$/g, ''); // Remove leading/trailing newlines only
    const alignment = isTable ? '' : (beginMatch[2] || '');

    return {
      type: 'environment',
      content,
      latex: fullLatex,
      start: position,
      end: endPos + endPattern.length,
      name: envName,
      params: alignment
    };
  }
}