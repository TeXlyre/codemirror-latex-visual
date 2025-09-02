import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { LatexToken } from '../../parsers/base-parser';

export class CommandWidget extends BaseLatexWidget {
  toDOM(view: EditorView): HTMLElement {
    const cmdName = this.token.name || '';
    const content = this.token.content || '';
    const colorArg = this.token.colorArg || '';

    if (this.showCommands) {
      const wrapper = document.createElement('span');
      wrapper.className = 'latex-command-raw latex-visual-widget';
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
    span.dataset.cmdName = cmdName;
    if (colorArg) span.dataset.colorArg = colorArg;

    if (this.token.children && this.token.children.length > 0) {
      this.renderChildren(span, this.token.children, view);
    } else {
      const nestedTokens = this.parseContent(content);
      if (nestedTokens.length > 1 || (nestedTokens.length === 1 && nestedTokens[0].type !== 'text')) {
        this.renderChildren(span, nestedTokens, view);
      } else {
        span.textContent = this.extractTextContent(content);
      }
    }

    this.applyCommandStyles(span, cmdName, colorArg);

    this.makeEditableWithNestedWidgets(
      span,
      view,
      content,
      (extractedContent) => {
        if (colorArg) {
          return `\\${cmdName}{${colorArg}}{${extractedContent}}`;
        } else {
          return `\\${cmdName}{${extractedContent}}`;
        }
      }
    );

    return span;
  }

  private applyCommandStyles(element: HTMLElement, cmdName: string, colorArg: string) {
    switch (cmdName) {
      case 'textbf':
        element.style.fontWeight = 'bold';
        break;
      case 'textit':
      case 'emph':
        element.style.fontStyle = 'italic';
        break;
      case 'underline':
        element.style.textDecoration = 'underline';
        break;
      case 'textsc':
        element.style.fontVariant = 'small-caps';
        break;
      case 'textsf':
        element.style.fontFamily = 'sans-serif';
        break;
      case 'texttt':
        element.style.fontFamily = 'monospace';
        element.style.background = 'rgba(0, 0, 0, 0.05)';
        element.style.borderRadius = '2px';
        element.style.padding = '1px 2px';
        break;
      case 'textcolor':
      case 'color':
        if (colorArg) {
          element.style.color = colorArg;
        }
        break;
      case 'colorbox':
        if (colorArg) {
          element.style.backgroundColor = colorArg;
          element.style.padding = '2px 4px';
          element.style.borderRadius = '2px';
        }
        break;
    }
  }

  private extractTextContent(content: string | any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(item => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && item.content) {
          return this.extractTextContent(item.content);
        }
        return '';
      }).join('');
    }

    if (content && typeof content === 'object' && content.content) {
      return this.extractTextContent(content.content);
    }

    return String(content || '');
  }
}