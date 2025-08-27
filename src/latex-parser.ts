import { latexVisualSchema } from './prosemirror-schema';
import { Node as PMNode } from 'prosemirror-model';

interface LatexToken {
  type: 'text' | 'math_inline' | 'math_display' | 'section' | 'environment' | 'command' | 'comment' | 'paragraph_break' | 'mixed_paragraph' | 'editable_command';
  content: string;
  latex: string;
  start: number;
  end: number;
  level?: number;
  name?: string;
  params?: string;
  children?: LatexToken[];
  elements?: Array<{
    type: 'text' | 'command' | 'math_inline' | 'editable_command';
    content: string | LatexToken[];
    latex: string;
    name?: string;
  }>;
}

const EDITABLE_COMMANDS = new Set([
  'textbf', 'textit', 'emph', 'underline', 'textsc', 'textsf', 'texttt',
  'section', 'subsection', 'subsubsection', 'title', 'author', 'date',
  'footnote', 'cite', 'ref', 'label', 'url', 'href'
]);

const FORMATTING_COMMANDS = new Map([
  ['textbf', 'strong'],
  ['textit', 'em'],
  ['emph', 'em']
]);

export function parseLatexToProseMirror(latex: string): PMNode {
  const tokens = tokenizeLatex(latex);
  return buildProseMirrorDoc(tokens);
}

export function renderProseMirrorToLatex(pmDoc: PMNode): string {
  const parts: string[] = [];

  pmDoc.descendants((node, pos) => {
    switch (node.type.name) {
      case 'comment':
        parts.push(node.attrs.latex);
        return false;
      case 'math_inline':
        parts.push(`$${node.attrs.latex}$`);
        return false;
      case 'math_display':
        parts.push(`$$${node.attrs.latex}$$`);
        return false;
      case 'section':
        const level = node.attrs.level || 1;
        const sectionType = level === 1 ? 'section' : level === 2 ? 'subsection' : 'subsubsection';
        parts.push(`\\${sectionType}{${node.textContent}}`);
        return false;
      case 'environment':
        if (node.content.size > 0) {
          const envName = node.attrs.name;
          const innerLatex = renderProseMirrorToLatex(node);
          parts.push(`\\begin{${envName}}\n${innerLatex}\n\\end{${envName}}`);
        } else {
          parts.push(node.attrs.latex);
        }
        return false;
      case 'editable_command':
        const cmdName = node.attrs.name;
        const innerContent = node.textContent;
        parts.push(`\\${cmdName}{${innerContent}}`);
        return false;
      case 'command':
        parts.push(node.attrs.latex);
        return false;
      case 'paragraph':
        if (node.content.size > 0) {
          const paragraphLatex = renderParagraphContent(node);
          if (paragraphLatex.trim()) {
            parts.push(paragraphLatex);
          }
        }
        return false;
      case 'hard_break':
        parts.push('\n');
        return false;
      case 'text':
        return true;
    }
    return true;
  });

  return parts.join('\n\n').replace(/\n\n\n+/g, '\n\n').trim();
}

function renderParagraphContent(paragraphNode: PMNode): string {
  let result = '';

  paragraphNode.descendants((node, pos) => {
    switch (node.type.name) {
      case 'text':
        result += node.text || '';
        return false;
      case 'math_inline':
        result += `$${node.attrs.latex}$`;
        return false;
      case 'editable_command':
        const cmdName = node.attrs.name;
        const innerContent = node.textContent;
        result += `\\${cmdName}{${innerContent}}`;
        return false;
      case 'command':
        result += node.attrs.latex;
        return false;
      default:
        return true;
    }
  });

  return result;
}

function tokenizeLatex(latex: string): LatexToken[] {
  const tokens: LatexToken[] = [];
  let pos = 0;

  while (pos < latex.length) {
    if (latex.charAt(pos) === '%') {
      const token = extractComment(latex, pos);
      tokens.push(token);
      pos = token.end;
      continue;
    }

    if (latex.startsWith('$$', pos)) {
      const token = extractDisplayMath(latex, pos);
      tokens.push(token);
      pos = token.end;
      continue;
    }

    if (latex.charAt(pos) === '$' && latex.charAt(pos + 1) !== '$') {
      const token = extractInlineMath(latex, pos);
      tokens.push(token);
      pos = token.end;
      continue;
    }

    if (latex.charAt(pos) === '\\') {
      if (latex.startsWith('\\section', pos) || latex.startsWith('\\subsection', pos) || latex.startsWith('\\subsubsection', pos)) {
        const token = extractSection(latex, pos);
        tokens.push(token);
        pos = token.end;
        continue;
      }

      if (latex.startsWith('\\begin{', pos)) {
        const token = extractEnvironment(latex, pos);
        tokens.push(token);
        pos = token.end;
        continue;
      }

      const token = extractMixedParagraph(latex, pos);
      tokens.push(token);
      pos = token.end;
      continue;
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

    const token = extractMixedParagraph(latex, pos);
    tokens.push(token);
    pos = token.end;
  }

  return tokens;
}

function extractComment(latex: string, start: number): LatexToken {
  let end = start + 1;
  while (end < latex.length && latex.charAt(end) !== '\n') {
    end++;
  }

  if (end < latex.length && latex.charAt(end) === '\n') {
    end++;
  }

  const fullComment = latex.slice(start, end);
  const commentContent = latex.slice(start + 1, end - (latex.charAt(end - 1) === '\n' ? 1 : 0));

  return {
    type: 'comment',
    content: commentContent,
    latex: fullComment,
    start,
    end
  };
}

function extractBalancedBraces(latex: string, start: number): { content: string; end: number } | null {
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

function extractCommandWithBraces(latex: string, start: number): { cmdName: string; cmdParams: string; fullCmd: string } | null {
  const cmdMatch = latex.slice(start).match(/^\\([a-zA-Z*]+)/);
  if (!cmdMatch) return null;

  const cmdName = cmdMatch[1];
  let pos = start + cmdMatch[0].length;
  let cmdParams = '';
  let fullCmd = cmdMatch[0];

  while (pos < latex.length && /\s/.test(latex.charAt(pos))) {
    pos++;
  }

  if (pos < latex.length && latex.charAt(pos) === '{') {
    const braceResult = extractBalancedBraces(latex, pos);
    if (braceResult) {
      cmdParams = braceResult.content;
      fullCmd = latex.slice(start, braceResult.end);
    }
  }

  return { cmdName, cmdParams, fullCmd };
}

function extractMixedParagraph(latex: string, start: number): LatexToken {
  const elements: Array<{
    type: 'text' | 'command' | 'math_inline' | 'editable_command';
    content: string | LatexToken[];
    latex: string;
    name?: string;
  }> = [];
  let pos = start;
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

    if (latex.charAt(pos) === '$' && latex.charAt(pos + 1) !== '$') {
      const mathEnd = findMatchingDollar(latex, pos + 1);
      if (mathEnd !== -1) {
        const mathContent = latex.slice(pos + 1, mathEnd);
        const mathLatex = latex.slice(pos, mathEnd + 1);
        elements.push({
          type: 'math_inline',
          content: mathContent,
          latex: mathLatex
        });
        fullContent += mathLatex;
        pos = mathEnd + 1;
        continue;
      }
    }

    if (latex.charAt(pos) === '\\') {
      const cmdResult = extractCommandWithBraces(latex, pos);
      if (cmdResult) {
        const { cmdName, cmdParams, fullCmd } = cmdResult;

        if (EDITABLE_COMMANDS.has(cmdName)) {
          const innerTokens = cmdParams ? tokenizeLatex(cmdParams) : [];
          elements.push({
            type: 'editable_command',
            content: innerTokens,
            latex: fullCmd,
            name: cmdName
          });
        } else {
          elements.push({
            type: 'command',
            content: cmdParams,
            latex: fullCmd,
            name: cmdName
          });
        }
        fullContent += fullCmd;
        pos += fullCmd.length;
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
      pos++;
    }
  }

  return {
    type: 'mixed_paragraph',
    content: fullContent,
    latex: fullContent,
    start,
    end: pos,
    elements
  };
}

function findMatchingDollar(latex: string, start: number): number {
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

function extractDisplayMath(latex: string, start: number): LatexToken {
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

function extractInlineMath(latex: string, start: number): LatexToken {
  const end = findMatchingDollar(latex, start + 1);
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

function extractSection(latex: string, start: number): LatexToken {
  const match = latex.slice(start).match(/^(\\(?:sub)*section\*?)\{([^}]*)\}/);
  if (!match) {
    return extractCommand(latex, start);
  }

  const level = match[1].includes('subsub') ? 3 : match[1].includes('sub') ? 2 : 1;
  const title = match[2];

  return {
    type: 'section',
    content: title,
    latex: match[0],
    start,
    end: start + match[0].length,
    level
  };
}

function extractEnvironment(latex: string, start: number): LatexToken {
  const beginMatch = latex.slice(start).match(/^\\begin\{([^}]+)\}/);
  if (!beginMatch) {
    return extractCommand(latex, start);
  }

  const envName = beginMatch[1];
  const endPattern = `\\end{${envName}}`;
  const endPos = latex.indexOf(endPattern, start + beginMatch[0].length);

  if (endPos === -1) {
    return {
      type: 'text',
      content: latex.slice(start),
      latex: latex.slice(start),
      start,
      end: latex.length
    };
  }

  const fullLatex = latex.slice(start, endPos + endPattern.length);
  const content = latex.slice(start + beginMatch[0].length, endPos);

  return {
    type: 'environment',
    content,
    latex: fullLatex,
    start,
    end: endPos + endPattern.length,
    name: envName
  };
}

function extractCommand(latex: string, start: number): LatexToken {
  const cmdResult = extractCommandWithBraces(latex, start);
  if (!cmdResult) {
    return {
      type: 'text',
      content: latex.charAt(start),
      latex: latex.charAt(start),
      start,
      end: start + 1
    };
  }

  return {
    type: 'command',
    content: cmdResult.cmdParams,
    latex: cmdResult.fullCmd,
    start,
    end: start + cmdResult.fullCmd.length,
    name: cmdResult.cmdName,
    params: ''
  };
}

function buildProseMirrorDoc(tokens: LatexToken[]): PMNode {
  const nodes: PMNode[] = [];
  let currentParagraphContent: any[] = [];

  const flushParagraph = () => {
    if (currentParagraphContent.length > 0) {
      nodes.push(latexVisualSchema.nodes.paragraph.create(
        {},
        currentParagraphContent
      ));
      currentParagraphContent = [];
    }
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'comment':
        flushParagraph();
        nodes.push(
          latexVisualSchema.nodes.comment.create(
            { latex: token.latex },
            token.content ? [latexVisualSchema.text(token.content)] : []
          )
        );
        break;

      case 'mixed_paragraph':
        if (token.elements) {
          for (const element of token.elements) {
            switch (element.type) {
              case 'text':
                if (typeof element.content === 'string' && element.content) {
                  currentParagraphContent.push(latexVisualSchema.text(element.content));
                }
                break;
              case 'math_inline':
                currentParagraphContent.push(
                  latexVisualSchema.nodes.math_inline.create({
                    latex: typeof element.content === 'string' ? element.content : '',
                    rendered: typeof element.content === 'string' ? element.content : ''
                  })
                );
                break;
              case 'editable_command':
                if (Array.isArray(element.content)) {
                  const innerDoc = buildProseMirrorDoc(element.content);

                  const commandNode = latexVisualSchema.nodes.editable_command.create({
                    name: element.name || '',
                    latex: element.latex
                  }, innerDoc.content);

                  currentParagraphContent.push(commandNode);
                } else {
                  currentParagraphContent.push(
                    latexVisualSchema.nodes.editable_command.create({
                      name: element.name || '',
                      latex: element.latex
                    })
                  );
                }
                break;
              case 'command':
                currentParagraphContent.push(
                  latexVisualSchema.nodes.editable_command.create({
                    name: element.name || '',
                    latex: element.latex
                  }, typeof element.content === 'string' && element.content ?
                    [latexVisualSchema.text(element.content)] : []
                  )
                );
                break;
            }
          }
        }
        break;

      case 'math_inline':
        currentParagraphContent.push(
          latexVisualSchema.nodes.math_inline.create({
            latex: token.content,
            rendered: token.content
          })
        );
        break;

      case 'math_display':
        flushParagraph();
        nodes.push(
          latexVisualSchema.nodes.math_display.create({
            latex: token.content,
            rendered: token.content
          })
        );
        break;

      case 'section':
        flushParagraph();
        nodes.push(
          latexVisualSchema.nodes.section.create(
            {
              level: token.level || 1,
              latex: token.latex
            },
            latexVisualSchema.text(token.content)
          )
        );
        break;

      case 'environment':
        flushParagraph();
        const envContent = token.content ? parseLatexToProseMirror(token.content) : null;
        nodes.push(
          latexVisualSchema.nodes.environment.create({
            name: token.name || '',
            latex: token.latex
          }, envContent ? envContent.content : undefined)
        );
        break;

      case 'command':
        currentParagraphContent.push(
          latexVisualSchema.nodes.editable_command.create({
            name: token.name || '',
            latex: token.latex
          }, token.content ? [latexVisualSchema.text(token.content)] : [])
        );
        break;

      case 'paragraph_break':
        flushParagraph();
        break;

      default:
        if (token.content.trim()) {
          currentParagraphContent.push(
            latexVisualSchema.text(token.content)
          );
        }
    }
  }

  flushParagraph();

  if (nodes.length === 0) {
    nodes.push(latexVisualSchema.nodes.paragraph.create());
  }

  return latexVisualSchema.nodes.doc.create({}, nodes);
}