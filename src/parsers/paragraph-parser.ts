import { BaseLatexParser, LatexToken } from './base-parser';
import { MathParser } from './math-parser';
import { CommandParser, EDITABLE_COMMANDS } from './command-parser';

export class ParagraphParser extends BaseLatexParser {
  private mathParser = new MathParser();
  private commandParser = new CommandParser();

  canParse(latex: string, position: number): boolean {
    return !latex.startsWith('\n\n', position) &&
           !latex.startsWith('$$', position) &&
           !latex.startsWith('\\section', position) &&
           !latex.startsWith('\\subsection', position) &&
           !latex.startsWith('\\subsubsection', position) &&
           !latex.startsWith('\\begin{', position) &&
           latex.charAt(position) !== '%';
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    const elements: Array<{
      type: 'text' | 'command' | 'math_inline' | 'editable_command';
      content: string | LatexToken[];
      latex: string;
      name?: string;
    }> = [];
    let pos = position;
    let fullContent = '';

    while (pos < latex.length) {
      if (latex.startsWith('\n\n', pos) ||
          latex.startsWith('$$', pos) ||
          latex.startsWith('\\section', pos) ||
          latex.startsWith('\\subsection', pos) ||
          latex.startsWith('\\subsubsection', pos) ||
          latex.startsWith('\\begin{', pos) ||
          latex.charAt(pos) === '%') {
        break;
      }

      if (this.mathParser.canParse(latex, pos)) {
        const mathToken = this.mathParser.parse(latex, pos);
        if (mathToken && mathToken.type === 'math_inline') {
          elements.push({
            type: 'math_inline',
            content: mathToken.content,
            latex: mathToken.latex
          });
          fullContent += mathToken.latex;
          pos = mathToken.end;
          continue;
        }
      }

      if (latex.charAt(pos) === '\\') {
        const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, pos);
        if (cmdResult) {
          const { name, params, fullCommand } = cmdResult;

          if (EDITABLE_COMMANDS.has(name)) {
            const innerTokens = params ? this.tokenizeLatex(params) : [];
            elements.push({
              type: 'editable_command',
              content: innerTokens,
              latex: fullCommand,
              name
            });
          } else {
            elements.push({
              type: 'command',
              content: params,
              latex: fullCommand,
              name
            });
          }
          fullContent += fullCommand;
          pos += fullCommand.length;
          continue;
        }
      }

      let textEnd = pos;
      while (textEnd < latex.length &&
             latex.charAt(textEnd) !== '$' &&
             latex.charAt(textEnd) !== '\\' &&
             latex.charAt(textEnd) !== '%' &&
             !latex.startsWith('\n\n', textEnd) &&
             !latex.startsWith('$$', textEnd) &&
             !latex.startsWith('\\section', textEnd) &&
             !latex.startsWith('\\subsection', textEnd) &&
             !latex.startsWith('\\subsubsection', textEnd) &&
             !latex.startsWith('\\begin{', textEnd)) {
        textEnd++;
      }

      if (textEnd > pos) {
        const textContent = latex.slice(pos, textEnd);
        elements.push({
          type: 'text',
          content: textContent,
          latex: textContent
        });
        fullContent += textContent;
        pos = textEnd;
      } else {
        const char = latex.charAt(pos);
        elements.push({
          type: 'text',
          content: char,
          latex: char
        });
        fullContent += char;
        pos++;
      }
    }

    return {
      type: 'mixed_paragraph',
      content: fullContent,
      latex: fullContent,
      start: position,
      end: pos,
      elements
    };
  }

  private tokenizeLatex(latex: string): LatexToken[] {
    const tokens: LatexToken[] = [];
    let pos = 0;

    while (pos < latex.length) {
      if (latex.charAt(pos) === '%') {
        break;
      }

      if (latex.startsWith('$$', pos)) {
        const token = this.mathParser.parse(latex, pos);
        if (token) {
          tokens.push(token);
          pos = token.end;
          continue;
        }
      }

      if (latex.charAt(pos) === '$' && latex.charAt(pos + 1) !== '$') {
        const token = this.mathParser.parse(latex, pos);
        if (token) {
          tokens.push(token);
          pos = token.end;
          continue;
        }
      }

      if (latex.charAt(pos) === '\\') {
        const token = this.parse(latex, pos);
        if (token) {
          tokens.push(token);
          pos = token.end;
          continue;
        }
      }

      if (latex.startsWith('\n\n', pos)) {
        tokens.push({
          type: 'paragraph_break',
          content: '',
          latex: '\n\n',
          start: pos,
          end: pos + 2
        });
        pos += 2;
        continue;
      }

      const token = this.parse(latex, pos);
      if (token) {
        tokens.push(token);
        pos = token.end;
      } else {
        pos++;
      }
    }

    return tokens;
  }
}