import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { NestedContentRenderer } from '../nested-content-renderer';

export class EnvironmentWidget extends BaseLatexWidget {
  private contentDiv?: HTMLElement;
  private isEditing: boolean = false;
  private currentEnvName: string;
  private currentContent: string;

  constructor(token: any, showCommands: boolean = false) {
    super(token, showCommands);
    this.currentEnvName = token.name || '';
    this.currentContent = token.content || '';
  }

  toDOM(view: EditorView): HTMLElement {
    if (this.showCommands) {
      return this.createCommandView(view);
    }

    const wrapper = document.createElement('div');
    wrapper.className = `latex-visual-environment latex-env-${this.currentEnvName}`;
    wrapper.style.margin = '0';
    wrapper.style.padding = '10px';
    wrapper.style.borderRadius = '4px';
    wrapper.style.lineHeight = '1.4';

    this.preserveLineHeight(wrapper, this.token.latex);

    const header = this.createHeader();
    this.contentDiv = this.createContentDiv(view);

    this.applyEnvironmentStyles(wrapper, header);
    this.setupHeaderEditing(header, wrapper, view);

    wrapper.appendChild(header);
    wrapper.appendChild(this.contentDiv);

    return wrapper;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'env-header';
    header.textContent = this.currentEnvName.charAt(0).toUpperCase() + this.currentEnvName.slice(1);
    header.style.fontWeight = 'bold';
    header.style.fontSize = '0.9em';
    header.style.marginBottom = '8px';
    header.style.textTransform = 'capitalize';
    header.style.cursor = 'pointer';
    header.style.padding = '2px 4px';
    header.style.borderRadius = '3px';
    header.style.transition = 'background-color 0.2s';
    header.title = 'Click to edit environment';

    header.addEventListener('mouseenter', () => {
      if (!this.isEditing) {
        header.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
      }
    });

    header.addEventListener('mouseleave', () => {
      if (!this.isEditing) {
        header.style.backgroundColor = '';
      }
    });

    return header;
  }

  private createContentDiv(view: EditorView): HTMLElement {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'env-content';
    contentDiv.style.lineHeight = '1.4';

    NestedContentRenderer.setupEditableNestedContent(
      contentDiv,
      this.currentContent,
      view,
      (newContent) => this.updateEnvironmentContent(view, newContent),
      this.showCommands
    );

    return contentDiv;
  }

  private createCommandView(view: EditorView): HTMLElement {
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
    beginDiv.textContent = `\\begin{${this.currentEnvName}}`;
    beginDiv.style.color = '#28a745';
    beginDiv.style.fontWeight = '600';
    beginDiv.style.margin = '0 0 5px 0';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'env-content';
    contentDiv.style.margin = '5px 0';
    contentDiv.style.paddingLeft = '20px';
    contentDiv.style.borderLeft = '2px solid rgba(40, 167, 69, 0.3)';

    NestedContentRenderer.setupEditableNestedContent(
      contentDiv,
      this.currentContent,
      view,
      (newContent) => this.updateEnvironmentContent(view, newContent),
      this.showCommands
    );

    const endDiv = document.createElement('div');
    endDiv.className = 'env-end';
    endDiv.textContent = `\\end{${this.currentEnvName}}`;
    endDiv.style.color = '#28a745';
    endDiv.style.fontWeight = '600';
    endDiv.style.margin = '5px 0 0 0';

    wrapper.appendChild(beginDiv);
    wrapper.appendChild(contentDiv);
    wrapper.appendChild(endDiv);

    return wrapper;
  }

  private setupHeaderEditing(header: HTMLElement, wrapper: HTMLElement, view: EditorView) {
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.startHeaderEditing(header, wrapper, view);
    });
  }

  private startHeaderEditing(header: HTMLElement, wrapper: HTMLElement, view: EditorView) {
    if (this.isEditing) return;
    this.isEditing = true;

    // Hide the normal environment display
    header.style.display = 'none';
    if (this.contentDiv) {
      this.contentDiv.style.display = 'none';
    }

    // Create the editing interface
    const editContainer = this.createEditingInterface(view);
    wrapper.appendChild(editContainer);

    // Focus the environment name input
    setTimeout(() => {
      const nameInput = editContainer.querySelector('.env-name-input') as HTMLInputElement;
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 10);

    // Setup save/cancel handlers
    this.setupEditingHandlers(editContainer, header, wrapper, view);
  }

  private createEditingInterface(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'env-editing-interface';
    container.style.fontFamily = 'monospace';
    container.style.background = 'rgba(40, 167, 69, 0.1)';
    container.style.border = '2px solid #28a745';
    container.style.borderRadius = '4px';
    container.style.padding = '12px';
    container.style.position = 'relative';

    // Begin line
    const beginLine = document.createElement('div');
    beginLine.style.marginBottom = '10px';
    beginLine.style.display = 'flex';
    beginLine.style.alignItems = 'center';
    beginLine.style.flexWrap = 'wrap';

    const beginPrefix = document.createElement('span');
    beginPrefix.textContent = '\\begin{';
    beginPrefix.style.color = '#28a745';
    beginPrefix.style.fontWeight = '600';
    beginPrefix.style.marginRight = '2px';

    const nameInput = document.createElement('input');
    nameInput.className = 'env-name-input';
    nameInput.type = 'text';
    nameInput.value = this.currentEnvName;
    nameInput.style.border = 'none';
    nameInput.style.background = 'rgba(255, 255, 255, 0.9)';
    nameInput.style.outline = '1px solid #28a745';
    nameInput.style.padding = '3px 6px';
    nameInput.style.borderRadius = '3px';
    nameInput.style.fontFamily = 'monospace';
    nameInput.style.fontWeight = '600';
    nameInput.style.color = '#28a745';
    nameInput.style.minWidth = '100px';
    nameInput.style.marginRight = '2px';

    const beginSuffix = document.createElement('span');
    beginSuffix.textContent = '}';
    beginSuffix.style.color = '#28a745';
    beginSuffix.style.fontWeight = '600';

    beginLine.appendChild(beginPrefix);
    beginLine.appendChild(nameInput);
    beginLine.appendChild(beginSuffix);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.className = 'env-content-editing';
    contentArea.contentEditable = 'true';
    contentArea.style.minHeight = '60px';
    contentArea.style.padding = '10px';
    contentArea.style.margin = '10px 0';
    contentArea.style.background = 'rgba(255, 255, 255, 0.7)';
    contentArea.style.border = '1px solid rgba(40, 167, 69, 0.4)';
    contentArea.style.borderRadius = '4px';
    contentArea.style.outline = 'none';
    contentArea.style.fontFamily = 'inherit';
    contentArea.style.lineHeight = '1.4';
    contentArea.style.whiteSpace = 'pre-wrap';

    // Render current content
    NestedContentRenderer.renderNestedContent(contentArea, this.currentContent, view, this.showCommands);

    // End line
    const endLine = document.createElement('div');
    endLine.style.display = 'flex';
    endLine.style.alignItems = 'center';

    const endPrefix = document.createElement('span');
    endPrefix.textContent = '\\end{';
    endPrefix.style.color = '#28a745';
    endPrefix.style.fontWeight = '600';

    const endName = document.createElement('span');
    endName.className = 'env-end-name';
    endName.textContent = this.currentEnvName;
    endName.style.color = '#28a745';
    endName.style.fontWeight = '600';

    const endSuffix = document.createElement('span');
    endSuffix.textContent = '}';
    endSuffix.style.color = '#28a745';
    endSuffix.style.fontWeight = '600';

    endLine.appendChild(endPrefix);
    endLine.appendChild(endName);
    endLine.appendChild(endSuffix);

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '8px';
    buttonContainer.style.right = '8px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '6px';

    const saveBtn = this.createActionButton('✓', '#28a745', 'Save changes');
    const cancelBtn = this.createActionButton('×', '#dc3545', 'Cancel editing');

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);

    // Update end name when begin name changes
    nameInput.addEventListener('input', () => {
      endName.textContent = nameInput.value;
    });

    container.appendChild(beginLine);
    container.appendChild(contentArea);
    container.appendChild(endLine);
    container.appendChild(buttonContainer);

    return container;
  }

  private createActionButton(text: string, bgColor: string, title: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.background = bgColor;
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '50%';
    button.style.width = '28px';
    button.style.height = '28px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.fontWeight = 'bold';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.title = title;
    return button;
  }

  private setupEditingHandlers(editContainer: HTMLElement, header: HTMLElement, wrapper: HTMLElement, view: EditorView) {
    const nameInput = editContainer.querySelector('.env-name-input') as HTMLInputElement;
    const contentArea = editContainer.querySelector('.env-content-editing') as HTMLElement;
    const saveBtn = editContainer.querySelector('button[title="Save changes"]') as HTMLButtonElement;
    const cancelBtn = editContainer.querySelector('button[title="Cancel editing"]') as HTMLButtonElement;

    const saveChanges = () => {
      const newName = nameInput.value.trim();
      const newContent = NestedContentRenderer.extractContentFromContainer(contentArea);

      if (newName && (newName !== this.currentEnvName || newContent !== this.currentContent)) {
        this.updateEnvironment(view, newName, newContent);
        this.updateVisualElements(header, wrapper, newName, newContent, view);
      }

      this.finishEditing(editContainer, header);
    };

    const cancelChanges = () => {
      this.finishEditing(editContainer, header);
    };

    // Button handlers
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveChanges();
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelChanges();
    });

    // Keyboard handlers
    nameInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        contentArea.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelChanges();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        contentArea.focus();
      }
    });

    contentArea.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelChanges();
      }
      // Allow normal text editing in content area
    });

    // Prevent event propagation
    [nameInput, contentArea, saveBtn, cancelBtn].forEach(element => {
      element.addEventListener('mousedown', (e) => e.stopPropagation());
      element.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  private updateEnvironment(view: EditorView, newName: string, newContent: string) {
    const newLatex = `\\begin{${newName}}\n${newContent.trim()}\n\\end{${newName}}`;

    // Find the current environment position in the document
    const pos = this.findCurrentEnvironmentPosition(view);
    if (pos) {
      // Update the document
      view.dispatch({
        changes: { from: pos.from, to: pos.to, insert: newLatex }
      });

      // Update our internal state
      this.currentEnvName = newName;
      this.currentContent = newContent.trim();
      this.token.name = newName;
      this.token.content = newContent.trim();
      this.token.latex = newLatex;
    }
  }

  private findCurrentEnvironmentPosition(view: EditorView): { from: number; to: number } | null {
    const doc = view.state.doc.toString();

    // Build current latex string to search for
    const currentLatex = `\\begin{${this.currentEnvName}}`;
    let searchPos = doc.indexOf(currentLatex);

    // If we can't find exact match, try with the original token
    if (searchPos === -1) {
      const originalStart = doc.indexOf(this.token.latex);
      if (originalStart !== -1) {
        searchPos = originalStart;
      }
    }

    if (searchPos === -1) return null;

    // Find the complete environment from this position
    const fromPos = searchPos;
    const endPattern = `\\end{${this.currentEnvName}}`;
    const endPos = doc.indexOf(endPattern, fromPos);

    if (endPos === -1) return null;

    return {
      from: fromPos,
      to: endPos + endPattern.length
    };
  }

  private updateVisualElements(header: HTMLElement, wrapper: HTMLElement, newName: string, newContent: string, view: EditorView) {
    // Update header text
    header.textContent = newName.charAt(0).toUpperCase() + newName.slice(1);

    // Update wrapper class
    wrapper.className = `latex-visual-environment latex-env-${newName}`;

    // Apply new styling
    this.applyEnvironmentStyles(wrapper, header);

    // Update content div
    if (this.contentDiv) {
      this.contentDiv.innerHTML = '';
      NestedContentRenderer.renderNestedContent(this.contentDiv, newContent, view, this.showCommands);
    }
  }

  private updateEnvironmentContent(view: EditorView, newContent: string) {
    if (newContent !== this.currentContent) {
      this.updateEnvironment(view, this.currentEnvName, newContent);
    }
  }

  private finishEditing(editContainer: HTMLElement, header: HTMLElement) {
    this.isEditing = false;

    // Remove editing interface
    if (editContainer.parentNode) {
      editContainer.parentNode.removeChild(editContainer);
    }

    // Show normal display
    header.style.display = 'block';
    if (this.contentDiv) {
      this.contentDiv.style.display = 'block';
    }
  }

  private applyEnvironmentStyles(wrapper: HTMLElement, header: HTMLElement) {
    const envName = this.currentEnvName;

    // Reset styles
    wrapper.style.borderLeft = '';
    wrapper.style.background = '';
    header.style.color = '';

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

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    if (this.contentDiv && !this.isEditing) {
      this.contentDiv.innerHTML = '';
      NestedContentRenderer.renderNestedContent(this.contentDiv, this.currentContent, view, this.showCommands);
    }
    return true;
  }
}