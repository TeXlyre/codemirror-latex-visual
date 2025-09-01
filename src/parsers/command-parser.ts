import { BaseLatexParser, LatexToken } from './base-parser';

export const EDITABLE_COMMANDS = new Set([
  'textbf', 'textit', 'emph', 'underline', 'textsc', 'textsf', 'texttt',
  'section', 'subsection', 'subsubsection', 'title', 'author', 'date',
  'footnote', 'cite', 'citeyear', 'citep', 'citey', 'ref', 'label', 'url', 'href',
  'textcolor', 'color', 'colorbox'
]);

export const FORMATTING_COMMANDS = new Map([
  ['textbf', 'strong'],
  ['textit', 'em'],
  ['emph', 'em']
]);

export class CommandParser extends BaseLatexParser {
  canParse(latex: string, position: number): boolean {
    return latex.charAt(position) === '\\';
  }

  parse(latex: string, position: number): LatexToken | null {
    if (!this.canParse(latex, position)) return null;

    if (latex.startsWith('\\textcolor', position) || latex.startsWith('\\colorbox', position)) {
      return this.parseColorCommand(latex, position);
    }

    const cmdResult = BaseLatexParser.extractCommandWithBraces(latex, position);

    if (!cmdResult) {
      const match = /^\\[a-zA-Z]+/.exec(latex.slice(position));
      if (match) {
        return {
          type: 'command',
          content: '',
          latex: match[0],
          start: position,
          end: position + match[0].length,
          name: match[0].slice(1),
          params: ''
        };
      }
      const char = latex.charAt(position);
      return {
        type: 'text',
        content: char,
        latex: char,
        start: position,
        end: position + 1
      };
    }

    const isKnown = EDITABLE_COMMANDS.has(cmdResult.name) || cmdResult.name === 'textcolor' || cmdResult.name === 'colorbox' || cmdResult.name === 'color';

    if (!isKnown) {
      const open = `\\${cmdResult.name}{`;
      const children = this.parseNestedContent(cmdResult.params || '');
      const token: LatexToken = {
        type: 'editable_command',
        content: cmdResult.params,
        latex: cmdResult.fullCommand,
        start: position,
        end: cmdResult.end,
        name: cmdResult.name,
        params: '',
        children: [
          {
            type: 'text',
            content: open,
            latex: open,
            start: position,
            end: position + open.length
          },
          ...children,
          {
            type: 'text',
            content: '}',
            latex: '}',
            start: cmdResult.end - 1,
            end: cmdResult.end
          }
        ]
      };
      return token;
    }

    const token: LatexToken = {
      type: 'editable_command',
      content: cmdResult.params,
      latex: cmdResult.fullCommand,
      start: position,
      end: cmdResult.end,
      name: cmdResult.name,
      params: '',
      colorArg: cmdResult.name === 'color' ? cmdResult.params : undefined
    };

    if (cmdResult.params) {
      token.children = this.parseNestedContent(cmdResult.params);
    }

    return token;
  }

  private parseNestedContent(content: string): LatexToken[] {
    const tokens: LatexToken[] = [];
    let pos = 0;

    while (pos < content.length) {
      if (content.charAt(pos) === '\\') {
        if (content.startsWith('\\textcolor', pos) || content.startsWith('\\colorbox', pos)) {
          const parsed = this.parse(content, pos);
          if (parsed) {
            tokens.push(parsed);
            pos = parsed.end;
            continue;
          }
        }
        const cmdResult = BaseLatexParser.extractCommandWithBraces(content, pos);
        if (cmdResult) {
          const isKnown = EDITABLE_COMMANDS.has(cmdResult.name) || cmdResult.name === 'textcolor' || cmdResult.name === 'colorbox' || cmdResult.name === 'color';
          if (isKnown) {
            const parsed = this.parse(content, pos);
            if (parsed) {
              tokens.push(parsed);
              pos = parsed.end;
              continue;
            }
          } else {
            const open = `\\${cmdResult.name}{`;
            tokens.push({
              type: 'text',
              content: open,
              latex: open,
              start: pos,
              end: pos + open.length
            });
            const inner = this.parseNestedContent(cmdResult.params || '');
            tokens.push(...inner);
            tokens.push({
              type: 'text',
              content: '}',
              latex: '}',
              start: cmdResult.end - 1,
              end: cmdResult.end
            });
            pos = cmdResult.end;
            continue;
          }
        }
        const match = /^\\[a-zA-Z]+/.exec(content.slice(pos));
        if (match) {
          tokens.push({
            type: 'text',
            content: match[0],
            latex: match[0],
            start: pos,
            end: pos + match[0].length
          });
          pos = pos + match[0].length;
          continue;
        }
      }

      let textEnd = pos;
      while (textEnd < content.length && content.charAt(textEnd) !== '\\') {
        textEnd++;
      }

      if (textEnd > pos) {
        tokens.push({
          type: 'text',
          content: content.slice(pos, textEnd),
          latex: content.slice(pos, textEnd),
          start: pos,
          end: textEnd
        });
      }

      pos = textEnd;
    }

    return tokens;
  }

  private parseColorCommand(latex: string, start: number): LatexToken | null {
    const isTextColor = latex.startsWith('\\textcolor', start);
    const isColorBox = latex.startsWith('\\colorbox', start);

    if (!isTextColor && !isColorBox) return null;

    let pos = start + (isTextColor ? 10 : 9);

    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    if (latex.charAt(pos) !== '{') return null;
    const colorResult = BaseLatexParser.extractBalancedBraces(latex, pos);
    if (!colorResult) return null;

    pos = colorResult.end;

    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    if (latex.charAt(pos) !== '{') return null;
    const contentResult = BaseLatexParser.extractBalancedBraces(latex, pos);
    if (!contentResult) return null;

    const fullCommand = latex.slice(start, contentResult.end);

    const token: LatexToken = {
      type: 'editable_command',
      content: contentResult.content,
      latex: fullCommand,
      start,
      end: contentResult.end,
      name: isTextColor ? 'textcolor' : 'colorbox',
      params: contentResult.content,
      colorArg: colorResult.content
    };

    if (contentResult.content) {
      token.children = this.parseNestedContent(contentResult.content);
    }

    return token;
  }
}
