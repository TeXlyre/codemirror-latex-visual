import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { NestedContentRenderer } from '../nested-content-renderer';

export class EnvironmentWidget extends BaseLatexWidget {
  private contentDiv?: HTMLElement;

  toDOM(view: EditorView): HTMLElement {
    const envName = this.token.name || '';
    const content = this.token.content || '';

    if (this.showCommands) {
      return this.createCommandView(view, envName, content);
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
    header.style.cursor = 'pointer';
    header.style.padding = '2px 4px';
    header.style.borderRadius = '3px';
    header.style.transition = 'background-color 0.2s';
    header.title = 'Click to edit environment';

    this.contentDiv = document.createElement('div');
    this.contentDiv.className = 'env-content';
    this.contentDiv.style.lineHeight = '1.4';

    NestedContentRenderer.setupEditableNestedContent(this.contentDiv, content, view, (newContent) => {
      this.updateContent(view, envName, newContent);
    }, this.showCommands);

    this.applyEnvironmentStyles(wrapper, header, envName);
    this.setupHeaderClick(header, view, envName, content);

    wrapper.appendChild(header);
    wrapper.appendChild(this.contentDiv);

    return wrapper;
  }

  private createCommandView(view: EditorView, envName: string, content: string): HTMLElement {
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

    this.contentDiv = document.createElement('div');
    this.contentDiv.className = 'env-content';
    this.contentDiv.style.margin = '5px 0';
    this.contentDiv.style.paddingLeft = '20px';
    this.contentDiv.style.borderLeft = '2px solid rgba(40, 167, 69, 0.3)';

    NestedContentRenderer.setupEditableNestedContent(this.contentDiv, content, view, (newContent) => {
      this.updateContent(view, envName, newContent);
    }, this.showCommands);

    const endDiv = document.createElement('div');
    endDiv.className = 'env-end';
    endDiv.textContent = `\\end{${envName}}`;
    endDiv.style.color = '#28a745';
    endDiv.style.fontWeight = '600';
    endDiv.style.margin = '5px 0 0 0';

    wrapper.appendChild(beginDiv);
    wrapper.appendChild(this.contentDiv);
    wrapper.appendChild(endDiv);

    return wrapper;
  }

  private setupHeaderClick(header: HTMLElement, view: EditorView, envName: string, content: string) {
    let isExpanded = false;
    let expandedView: HTMLElement | null = null;

    const toggleExpanded = () => {
      if (isExpanded && expandedView) {
        header.style.display = 'block';
        if (expandedView.parentNode) {
          expandedView.parentNode.removeChild(expandedView);
        }
        expandedView = null;
        isExpanded = false;
        return;
      }

      isExpanded = true;
      header.style.display = 'none';

      expandedView = this.createCommandView(view, envName, this.token.content || '');
      expandedView.style.margin = '0 0 8px 0';
      expandedView.style.position = 'relative';

      this.addControlButtons(expandedView, view, envName, () => toggleExpanded());

      if (header.parentNode) {
        header.parentNode.insertBefore(expandedView, header);
      }
    };

    header.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleExpanded();
    });

    header.addEventListener('mouseenter', () => {
      if (!isExpanded) {
        header.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
      }
    });

    header.addEventListener('mouseleave', () => {
      if (!isExpanded) {
        header.style.backgroundColor = '';
      }
    });
  }

  private addControlButtons(expandedView: HTMLElement, view: EditorView, envName: string, closeCallback: () => void) {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '5px';
    buttonContainer.style.right = '5px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '4px';

    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = '✓';
    saveBtn.style.background = 'rgba(40, 167, 69, 0.8)';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '50%';
    saveBtn.style.width = '20px';
    saveBtn.style.height = '20px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontSize = '12px';
    saveBtn.style.lineHeight = '1';
    saveBtn.style.display = 'flex';
    saveBtn.style.alignItems = 'center';
    saveBtn.style.justifyContent = 'center';
    saveBtn.title = 'Save and close';

    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = '×';
    cancelBtn.style.background = 'rgba(220, 53, 69, 0.8)';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '50%';
    cancelBtn.style.width = '20px';
    cancelBtn.style.height = '20px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '12px';
    cancelBtn.style.lineHeight = '1';
    cancelBtn.style.display = 'flex';
    cancelBtn.style.alignItems = 'center';
    cancelBtn.style.justifyContent = 'center';
    cancelBtn.title = 'Cancel without saving';

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    expandedView.appendChild(buttonContainer);

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      const currentContent = NestedContentRenderer.extractContentFromContainer(
        expandedView.querySelector('.env-content') as HTMLElement
      );

      const newLatex = `\\begin{${envName}}\n${currentContent}\n\\end{${envName}}`;
      this.updateTokenInEditor(view, newLatex);

      this.token.content = currentContent;
      this.token.latex = newLatex;

      closeCallback();

      if (this.contentDiv) {
        this.contentDiv.innerHTML = '';
        NestedContentRenderer.renderNestedContent(this.contentDiv, currentContent, view, this.showCommands);
      }
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCallback();
    });
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    if (this.contentDiv) {
      const content = this.token.content || '';
      this.contentDiv.innerHTML = '';
      NestedContentRenderer.renderNestedContent(this.contentDiv, content, view, this.showCommands);
    }

    return true;
  }

  private applyEnvironmentStyles(wrapper: HTMLElement, header: HTMLElement, envName: string) {
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
  }

  private updateContent(view: EditorView, envName: string, newContent: string) {
    const newLatex = `\\begin{${envName}}\n${newContent}\n\\end{${envName}}`;
    this.updateTokenInEditor(view, newLatex);
  }
}