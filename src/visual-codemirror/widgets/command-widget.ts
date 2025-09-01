import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';

export class CommandWidget extends BaseLatexWidget {
  toDOM(view: EditorView): HTMLElement {
    const cmdName = this.token.name || '';
    const content = this.token.content || '';
    const colorArg = this.token.colorArg || '';

    if (this.showCommands) {
      const wrapper = document.createElement('span');
      wrapper.className = 'latex-command-raw';
      wrapper.style.display = 'inline-block';
      wrapper.style.margin = '0 2px';
      wrapper.style.padding = '2px 6px';
      wrapper.style.background = 'rgba(220, 53, 69, 0.1)';
      wrapper.style.border = '1px solid rgba(220, 53, 69, 0.3)';
      wrapper.style.borderRadius = '3px';
      wrapper.style.fontFamily = 'monospace';
      wrapper.style.fontSize = '0.9em';
      wrapper.style.color = '#dc3545';

      if (colorArg) {
        wrapper.textContent = `\\${cmdName}{${colorArg}}{${content}}`;
      } else {
        wrapper.textContent = `\\${cmdName}{${content}}`;
      }

      this.makeEditable(wrapper, view, (newLatex) => {
        if (newLatex !== this.token.latex) {
          this.updateTokenInEditor(view, newLatex);
        }
      });

      return wrapper;
    }

    const span = document.createElement('span');
    span.className = `latex-visual-command ${cmdName}`;
    span.textContent = content;

    switch (cmdName) {
      case 'textbf':
        span.style.fontWeight = 'bold';
        break;
      case 'textit':
      case 'emph':
        span.style.fontStyle = 'italic';
        break;
      case 'underline':
        span.style.textDecoration = 'underline';
        break;
      case 'textsc':
        span.style.fontVariant = 'small-caps';
        break;
      case 'textsf':
        span.style.fontFamily = 'sans-serif';
        break;
      case 'texttt':
        span.style.fontFamily = 'monospace';
        span.style.background = 'rgba(0, 0, 0, 0.05)';
        span.style.borderRadius = '2px';
        span.style.padding = '1px 2px';
        break;
      case 'textcolor':
      case 'color':
        if (colorArg) {
          span.style.color = colorArg;
        }
        break;
      case 'colorbox':
        if (colorArg) {
          span.style.backgroundColor = colorArg;
          span.style.padding = '2px 4px';
          span.style.borderRadius = '2px';
        }
        break;
    }

    this.makeEditable(span, view, (newContent) => {
      if (newContent !== content) {
        let newLatex;
        if (colorArg) {
          newLatex = `\\${cmdName}{${colorArg}}{${newContent}}`;
        } else {
          newLatex = `\\${cmdName}{${newContent}}`;
        }
        this.updateTokenInEditor(view, newLatex);
      }
    });

    return span;
  }
}