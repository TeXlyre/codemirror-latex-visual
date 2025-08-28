import { latexVisualSchema } from './prosemirror-schema';
import { Node as PMNode } from 'prosemirror-model';
import { LatexTokenizer } from './parsers/main-parser';
import { LatexRenderer } from './renderers/main-renderer';
import { LatexToken } from './parsers/base-parser';

const tokenizer = new LatexTokenizer();
const renderer = new LatexRenderer();

export function parseLatexToProseMirror(latex: string): PMNode {
  const tokens = tokenizer.tokenize(latex);
  return buildProseMirrorDoc(tokens);
}

export function renderProseMirrorToLatex(pmDoc: PMNode, showCommands: boolean = false): string {
  renderer.updateOptions({ showCommands });
  return renderer.render(pmDoc);
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
              latex: token.latex,
              name: token.name || ''
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