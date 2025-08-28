export interface LatexToken {
  type: 'text' | 'math_inline' | 'math_display' | 'section' | 'environment' | 'command' | 'comment' | 'paragraph_break' | 'mixed_paragraph' | 'editable_command';
  content: string;
  latex: string;
  start: number;
  end: number;
  level?: number;
  name?: string;
  params?: string;
  colorArg?: string;
  children?: LatexToken[];
  elements?: Array<{
    type: 'text' | 'command' | 'math_inline' | 'editable_command';
    content: string | LatexToken[];
    latex: string;
    name?: string;
    colorArg?: string;
  }>;
}

export interface ParseResult {
  content: string;
  end: number;
}

export interface CommandParseResult extends ParseResult {
  name: string;
  params: string;
  fullCommand: string;
}

export abstract class BaseLatexParser {
  protected static extractBalancedBraces(latex: string, start: number): { content: string; end: number } | null {
    if (latex.charAt(start) !== '{') return null;

    let pos = start + 1;
    let braceCount = 1;
    let escaped = false;

    while (pos < latex.length && braceCount > 0) {
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

      if (latex.charAt(pos) === '{') {
        braceCount++;
      } else if (latex.charAt(pos) === '}') {
        braceCount--;
      }

      pos++;
    }

    if (braceCount === 0) {
      return {
        content: latex.slice(start + 1, pos - 1),
        end: pos
      };
    }

    return null;
  }

  protected static extractCommandWithBraces(latex: string, start: number): CommandParseResult | null {
    const cmdMatch = latex.slice(start).match(/^\\([a-zA-Z*]+)/);
    if (!cmdMatch) return null;

    const name = cmdMatch[1];
    let pos = start + cmdMatch[0].length;
    let params = '';
    let fullCommand = cmdMatch[0];

    while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
      pos++;
    }

    if (pos < latex.length && latex.charAt(pos) === '{') {
      const braceResult = this.extractBalancedBraces(latex, pos);
      if (braceResult) {
        params = braceResult.content;
        fullCommand = latex.slice(start, braceResult.end);
      }
    }

    return { name, params, fullCommand, content: params, end: start + fullCommand.length };
  }

  abstract canParse(latex: string, position: number): boolean;
  abstract parse(latex: string, position: number): LatexToken | null;
}