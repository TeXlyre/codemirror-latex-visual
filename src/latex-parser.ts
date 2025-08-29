import { latexVisualSchema } from './prosemirror-schema';
import { Node as PMNode } from 'prosemirror-model';
import { LatexTokenizer } from './parsers/main-parser';
import { LatexRenderer } from './renderers/main-renderer';
import { LatexToken } from './parsers/base-parser';

const tokenizer = new LatexTokenizer();
const renderer = new LatexRenderer();

export function parseLatexToProseMirror(latex: string, showCommands: boolean = false): PMNode {
  const tokens = tokenizer.tokenize(latex);
  return buildProseMirrorDoc(tokens, showCommands);
}

export function renderProseMirrorToLatex(pmDoc: PMNode, showCommands: boolean = false): string {
  renderer.updateOptions({ showCommands });
  return renderer.render(pmDoc);
}

function buildProseMirrorDoc(tokens: LatexToken[], showCommands: boolean = false): PMNode {
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
                if (typeof element.content === 'string') {
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
                const commandNode = createCommandNode(element, showCommands);
                if (commandNode) {
                  currentParagraphContent.push(commandNode);
                }
                break;
              case 'command':
                const regularCommandNode = createCommandNode(element, showCommands);
                if (regularCommandNode) {
                  currentParagraphContent.push(regularCommandNode);
                }
                break;
            }
          }
          flushParagraph();
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
              latex: token.latex,
              name: token.name || '',
              showCommands
            },
            latexVisualSchema.text(token.content)
          )
        );
        break;

      case 'environment':
        flushParagraph();

        if (token.name === 'tabular') {
          const tableNode = parseTabularEnvironment(token, showCommands);
          if (tableNode) {
            nodes.push(tableNode);
          }
        } else {
          const envContent = token.content ? parseLatexToProseMirror(token.content, showCommands) : null;
          nodes.push(
            latexVisualSchema.nodes.environment.create({
              name: token.name || '',
              latex: token.latex,
              showCommands
            }, envContent ? envContent.content : undefined)
          );
        }
        break;

      case 'command':
        const commandNode = createCommandNode({
          type: 'editable_command',
          content: token.content,
          latex: token.latex,
          name: token.name,
          colorArg: token.colorArg
        }, showCommands);
        if (commandNode) {
          currentParagraphContent.push(commandNode);
        }
        break;

      case 'paragraph_break':
        flushParagraph();
        nodes.push(
          latexVisualSchema.nodes.paragraph_break.create({
            latex: token.latex
          })
        );
        break;

      default:
        if (token.content && token.content.trim()) {
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

function parseTabularEnvironment(token: any, showCommands: boolean): any {
  const alignment = token.params || '';
  const content = token.content || '';

  const rows = content.split('\\\\').map((row: string) => row.trim()).filter((row: string) => row);
  const tableRows: any[] = [];

  for (const rowContent of rows) {
    const cells = rowContent.split('&').map((cell: string) => cell.trim());
    const tableCells: any[] = [];

    for (let i = 0; i < cells.length; i++) {
      const cellContent = cells[i];
      const align = alignment.charAt(i) || 'l';

      let cellNodes: any[] = [];
      if (cellContent) {
        const cellTokens = new LatexTokenizer().tokenize(cellContent);
        const cellDoc = buildProseMirrorDoc(cellTokens, showCommands);

        cellDoc.content.forEach((node: any) => {
          if (node.type.name === 'paragraph') {
            cellNodes.push(...node.content.content);
          } else {
            cellNodes.push(node);
          }
        });
      }

      tableCells.push(
        latexVisualSchema.nodes.table_cell.create(
          { alignment: align },
          cellNodes
        )
      );
    }

    if (tableCells.length > 0) {
      tableRows.push(
        latexVisualSchema.nodes.table_row.create({}, tableCells)
      );
    }
  }

  return latexVisualSchema.nodes.table.create({
    alignment,
    latex: token.latex,
    showCommands
  }, tableRows);
}

function createCommandNode(element: any, showCommands: boolean): any {
  if (!element.name) return null;

  let content: any[] = [];

  if (typeof element.content === 'string' && element.content) {
    content = [latexVisualSchema.text(element.content)];
  } else if (Array.isArray(element.content)) {
    const innerDoc = buildProseMirrorDoc(element.content, showCommands);
    content = Array.from(innerDoc.content.content);
  }

  return latexVisualSchema.nodes.editable_command.create({
    name: element.name,
    latex: element.latex,
    showCommands,
    colorArg: element.colorArg || ''
  }, content);
}