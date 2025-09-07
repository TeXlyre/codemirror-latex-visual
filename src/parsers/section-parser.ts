import { BaseLatexParser, LatexToken } from './base-parser';

export class SectionParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.startsWith('\\section', position) ||
           latex.startsWith('\\subsection', position) ||
           latex.startsWith('\\subsubsection', position);
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    const match = latex.slice(position).match(/^(\\(?:sub)*section\*?)\{([^}]*)\}/);
    if (!match) {
      const incompleteMatch = latex.slice(position).match(/^(\\(?:sub)*section\*?)(\{[^}]*)?$/);
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

    const level = match[1].includes('subsub') ? 3 : match[1].includes('sub') ? 2 : 1;
    const title = match[2];

    return {
      type: 'section',
      content: title,
      latex: match[0],
      start: position,
      end: position + match[0].length,
      level,
      name: match[1].substring(1)
    };
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