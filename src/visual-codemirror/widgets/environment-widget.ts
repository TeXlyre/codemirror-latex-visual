import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { NestedContentRenderer } from '../nested-content-renderer';

export class EnvironmentWidget extends BaseLatexWidget {
  toDOM(view: EditorView): HTMLElement {
    const envName = this.token.name || '';
    const content = this.token.content || '';

    if (this.showCommands) {
      const wrapper = document.createElement('div');
      wrapper.className = 'latex-env-command';
      wrapper.style.margin = '0';
      wrapper.style.padding = '10px';
      wrapper.style.background = 'rgba(40, 167, 69, 0.1)';
      wrapper.style.border = '1px solid rgba(40, 167, 69, 0.3)';
      wrapper.style.borderRadius = '4px';
      wrapper.style.fontFamily = 'monospace';
      wrapper.style.lineHeight = '1.4';

      this.preserveLineHeight(wrapper, this.token.latex);

      const beginDiv = document.createElement('div');
      beginDiv.className = 'env-begin';
      beginDiv.textContent = `\\begin{${envName}}`;
      beginDiv.style.color = '#28a745';
      beginDiv.style.fontWeight = '600';
      beginDiv.style.margin = '0 0 5px 0';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'env-content';
      contentDiv.style.margin = '5px 0';
      contentDiv.style.paddingLeft = '20px';
      contentDiv.style.borderLeft = '2px solid rgba(40, 167, 69, 0.3)';

      // Check if content has complex tokens
      const tokens = NestedContentRenderer.tokenizer.tokenize(content);
      const hasComplexTokens = tokens.some(token =>
        token.type !== 'text' && token.type !== 'paragraph_break'
      );

      if (hasComplexTokens) {
        NestedContentRenderer.setupEditableNestedContent(contentDiv, content, view, (newContent) => {
          if (newContent !== content) {
            const newLatex = `\\begin{${envName}}\n${newContent}\n\\end{${envName}}`;
            this.updateTokenInEditor(view, newLatex);
          }
        }, this.showCommands);
      } else {
        // Simple text editing for plain content
        contentDiv.contentEditable = 'true';
        contentDiv.style.outline = 'none';
        contentDiv.textContent = content;

        let updateTimeout: number;
        let isUpdating = false;

        contentDiv.addEventListener('input', (e) => {
          e.stopPropagation();
          if (isUpdating) return;

          clearTimeout(updateTimeout);
          updateTimeout = window.setTimeout(() => {
            isUpdating = true;
            const newContent = contentDiv.textContent || '';
            if (newContent !== content) {
              const newLatex = `\\begin{${envName}}\n${newContent}\n\\end{${envName}}`;
              this.updateTokenInEditor(view, newLatex);
            }
            setTimeout(() => { isUpdating = false; }, 100);
          }, 1000);
        });

        contentDiv.addEventListener('keydown', (e) => {
          e.stopPropagation();
        });

        contentDiv.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });

        contentDiv.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        contentDiv.addEventListener('blur', () => {
          if (isUpdating) return;
          clearTimeout(updateTimeout);
          const newContent = contentDiv.textContent || '';
          if (newContent !== content) {
            const newLatex = `\\begin{${envName}}\n${newContent}\n\\end{${envName}}`;
            this.updateTokenInEditor(view, newLatex);
          }
        });
      }

      const endDiv = document.createElement('div');
      endDiv.className = 'env-end';
      endDiv.textContent = `\\end{${envName}}`;
      endDiv.style.color = '#28a745';
      endDiv.style.fontWeight = '600';
      endDiv.style.margin = '5px 0 0 0';

      wrapper.appendChild(beginDiv);
      wrapper.appendChild(contentDiv);
      wrapper.appendChild(endDiv);

      return wrapper;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `latex-visual-environment latex-env-${envName}`;
    wrapper.style.margin = '0';
    wrapper.style.padding = '10px';
    wrapper.style.borderRadius = '4px';
    wrapper.style.lineHeight = '1.4';

    this.preserveLineHeight(wrapper, this.token.latex);

    const header = document.createElement('div');
    header.className = 'env-header';
    header.textContent = envName.charAt(0).toUpperCase() + envName.slice(1);
    header.style.fontWeight = 'bold';
    header.style.fontSize = '0.9em';
    header.style.marginBottom = '8px';
    header.style.textTransform = 'capitalize';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'env-content';
    contentDiv.style.lineHeight = '1.4';

    // Check if content has complex tokens
    const tokens = NestedContentRenderer.tokenizer.tokenize(content);
    const hasComplexTokens = tokens.some(token =>
      token.type !== 'text' && token.type !== 'paragraph_break'
    );

    if (hasComplexTokens) {
      NestedContentRenderer.setupEditableNestedContent(contentDiv, content, view, (newContent) => {
        if (newContent !== content) {
          const newLatex = `\\begin{${envName}}\n${newContent}\n\\end{${envName}}`;
          this.updateTokenInEditor(view, newLatex);
        }
      }, this.showCommands);
    } else {
      // Simple text editing for plain content
      contentDiv.contentEditable = 'true';
      contentDiv.style.outline = 'none';
      contentDiv.textContent = content;

      let updateTimeout: number;
      let isUpdating = false;

      contentDiv.addEventListener('input', (e) => {
        e.stopPropagation();
        if (isUpdating) return;

        clearTimeout(updateTimeout);
        updateTimeout = window.setTimeout(() => {
          isUpdating = true;
          const newContent = contentDiv.textContent || '';
          if (newContent !== content) {
            const newLatex = `\\begin{${envName}}\n${newContent}\n\\end{${envName}}`;
            this.updateTokenInEditor(view, newLatex);
          }
          setTimeout(() => { isUpdating = false; }, 100);
        }, 1000);
      });

      contentDiv.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });

      contentDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      contentDiv.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      contentDiv.addEventListener('blur', () => {
        if (isUpdating) return;
        clearTimeout(updateTimeout);
        const newContent = contentDiv.textContent || '';
        if (newContent !== content) {
          const newLatex = `\\begin{${envName}}\n${newContent}\n\\end{${envName}}`;
          this.updateTokenInEditor(view, newLatex);
        }
      });
    }

    switch (envName) {
      case 'theorem':
        wrapper.style.borderLeft = '3px solid #6f42c1';
        wrapper.style.background = 'rgba(111, 66, 193, 0.05)';
        header.style.color = '#6f42c1';
        break;
      case 'proof':
        wrapper.style.borderLeft = '3px solid #fd7e14';
        wrapper.style.background = 'rgba(253, 126, 20, 0.05)';
        header.style.color = '#fd7e14';
        break;
      case 'definition':
        wrapper.style.borderLeft = '3px solid #20c997';
        wrapper.style.background = 'rgba(32, 201, 151, 0.05)';
        header.style.color = '#20c997';
        break;
      default:
        wrapper.style.borderLeft = '3px solid #28a745';
        wrapper.style.background = 'rgba(40, 167, 69, 0.05)';
        header.style.color = '#28a745';
    }

    wrapper.appendChild(header);
    wrapper.appendChild(contentDiv);

    return wrapper;
  }
}