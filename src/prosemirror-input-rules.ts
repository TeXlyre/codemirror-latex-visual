import { inputRules, InputRule } from 'prosemirror-inputrules';
import { Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { LatexTokenizer } from './parsers/main-parser';
import { parseLatexToProseMirror } from './latex-parser';

function createLatexCommandInputRule(schema: Schema, tokenizer: LatexTokenizer): InputRule {
  return new InputRule(
    /\\[a-zA-Z*]+(?:\{[^}]*\})*$/,
    (state, match, start, end) => {
      const latexText = match[0];
      const showCommands = (window as any).latexEditorShowCommands || false;

      try {
        const tokens = tokenizer.tokenize(latexText);
        if (tokens.length === 1) {
          const token = tokens[0];

          if (token.type === 'editable_command' || token.type === 'command' ||
              token.type === 'section' || token.type === 'math_inline') {

            const pmDoc = parseLatexToProseMirror(latexText, showCommands);
            if (pmDoc.content.size > 0) {
              const firstChild = pmDoc.content.firstChild;
              if (firstChild) {
                if (firstChild.type.name === 'paragraph' && firstChild.content.size > 0) {
                  const node = firstChild.content.firstChild;
                  if (node) {
                    return state.tr.replaceWith(start, end, node);
                  }
                } else {
                  return state.tr.replaceWith(start, end, firstChild);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse LaTeX input:', error);
      }

      return null;
    }
  );
}

function createMathInputRule(schema: Schema, tokenizer: LatexTokenizer): InputRule {
  return new InputRule(
    /\$[^$]*\$$/,
    (state, match, start, end) => {
      const mathText = match[0];

      try {
        const tokens = tokenizer.tokenize(mathText);
        if (tokens.length === 1 && tokens[0].type === 'math_inline') {
          const showCommands = (window as any).latexEditorShowCommands || false;
          const pmDoc = parseLatexToProseMirror(mathText, showCommands);

          if (pmDoc.content.size > 0) {
            const firstChild = pmDoc.content.firstChild;
            if (firstChild?.type.name === 'paragraph' && firstChild.content.size > 0) {
              const node = firstChild.content.firstChild;
              if (node?.type.name === 'math_inline') {
                return state.tr.replaceWith(start, end, node);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse math input:', error);
      }

      return null;
    }
  );
}

export function createLatexInputRules(schema: Schema): Plugin {
  const tokenizer = new LatexTokenizer();

  return inputRules({
    rules: [
      createLatexCommandInputRule(schema, tokenizer),
      createMathInputRule(schema, tokenizer)
    ]
  });
}