// src/visual-codemirror/widgets/environment-widget.ts
import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';
import { NestedContentRenderer } from '../nested-content-renderer';

type Pair = { from: number; to: number; contentStart: number };

export class EnvironmentWidget extends BaseLatexWidget {
  private contentDiv?: HTMLElement;
  private isEditing: boolean = false;
  private currentEnvName: string;
  private currentContent: string;
  private isNested: boolean = false;
  private parentWidget?: HTMLElement;
  private pairIndex?: number;

  constructor(token: any, showCommands: boolean = false) {
    super(token, showCommands);
    this.currentEnvName = token.name || '';
    this.currentContent = token.content || '';
    this.isNested = this.detectIfNested();
  }

  private detectIfNested(): boolean {
    const latex = this.token.latex || '';
    const envName = this.currentEnvName;
    const doc = latex;
    const beginPattern = `\\begin{${envName}}`;
    let beginCount = 0;
    let pos = 0;
    while ((pos = doc.indexOf(beginPattern, pos)) !== -1) {
      beginCount++;
      pos += beginPattern.length;
    }
    return beginCount > 1;
  }

  toDOM(view: EditorView): HTMLElement {
    if (this.showCommands) {
      return this.createCommandView(view);
    }
    this.pairIndex = this.computePairIndex(view);
    (this.token as any)._pairIndex = this.pairIndex;
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
    header.style.display = 'none';
    if (this.contentDiv) {
      this.contentDiv.style.display = 'none';
    }
    const editContainer = this.createEditingInterface(view);
    wrapper.appendChild(editContainer);
    setTimeout(() => {
      const nameInput = editContainer.querySelector('.env-name-input') as HTMLInputElement;
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 10);
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
    NestedContentRenderer.renderNestedContent(contentArea, this.currentContent, view, this.showCommands);
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
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveChanges();
    });
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelChanges();
    });
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
    });
    [nameInput, contentArea, saveBtn, cancelBtn].forEach(element => {
      element.addEventListener('mousedown', (e) => e.stopPropagation());
      element.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  private updateEnvironment(view: EditorView, newName: string, newContent: string) {
    const newLatex = `\\begin{${newName}}\n${newContent.trim()}\n\\end{${newName}}`;
    const pos = this.findCurrentEnvironmentPosition(view);
    if (pos) {
      try {
        const approxLen = this.token.latex?.length ?? newLatex.length;
        const foundLen = pos.to - pos.from;
        if (foundLen > approxLen * 10) return;
        view.dispatch({
          changes: { from: pos.from, to: pos.to, insert: newLatex }
        });
        this.currentEnvName = newName;
        this.currentContent = newContent.trim();
        this.token.name = newName;
        this.token.content = newContent.trim();
        this.token.latex = newLatex;
        this.token.start = pos.from;
        this.token.end = pos.from + newLatex.length;
        this.pairIndex = this.computePairIndex(view);
        (this.token as any)._pairIndex = this.pairIndex;
      } catch {}
    }
  }

  private findCurrentEnvironmentPosition(view: EditorView): { from: number; to: number } | null {
    const doc = view.state.doc.toString();
    if (typeof this.token.start === 'number' && typeof this.token.end === 'number') {
      if (this.token.start < doc.length && this.token.end <= doc.length) {
        const originalLatex = doc.slice(this.token.start, this.token.end);
        if (originalLatex === this.token.latex) {
          return { from: this.token.start, to: this.token.end };
        }
      }
    }
    const exactMatch = this.findExactTokenMatch(doc);
    if (exactMatch) return exactMatch;
    return this.findEnvironmentByPairs(doc);
  }

  private findExactTokenMatch(doc: string): { from: number; to: number } | null {
    const tokenLatex = this.token.latex;
    if (!tokenLatex) return null;
    let startPos = 0;
    while ((startPos = doc.indexOf(tokenLatex, startPos)) !== -1) {
      const endPos = startPos + tokenLatex.length;
      return { from: startPos, to: endPos };
    }
    return null;
  }

  private computePairs(doc: string, envName: string): Pair[] {
    const escaped = envName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const beginRe = new RegExp('\\\\begin\\{' + escaped + '\\}', 'g');
    const optArgRe = /\[[^\]]*\]/y;
    const mandArgRe = /\{[^}]*\}/y;
    const endStr = `\\end{${envName}}`;
    const endRe = new RegExp(endStr, 'g');
    const events: Array<{ kind: 'b' | 'e'; index: number; contentStart?: number }> = [];
    let m: RegExpExecArray | null;

    while ((m = beginRe.exec(doc)) !== null) {
      let cs = beginRe.lastIndex;
      optArgRe.lastIndex = cs;
      const opt = optArgRe.exec(doc);
      if (opt && opt.index === cs) cs = optArgRe.lastIndex;
      mandArgRe.lastIndex = cs;
      const mand = mandArgRe.exec(doc);
      if (mand && mand.index === cs) cs = mandArgRe.lastIndex;
      events.push({ kind: 'b', index: m.index, contentStart: cs });
      if (beginRe.lastIndex === m.index) beginRe.lastIndex++;
    }

    while ((m = endRe.exec(doc)) !== null) {
      events.push({ kind: 'e', index: m.index });
      if (endRe.lastIndex === m.index) endRe.lastIndex++;
    }

    events.sort((a, b) => a.index - b.index || (a.kind === 'e' ? -1 : 1));

    const stack: Array<{ from: number; contentStart: number }> = [];
    const pairs: Pair[] = [];
    for (const ev of events) {
      if (ev.kind === 'b') {
        stack.push({ from: ev.index, contentStart: ev.contentStart! });
      } else {
        const top = stack.pop();
        if (top) pairs.push({ from: top.from, to: ev.index + endStr.length, contentStart: top.contentStart });
      }
    }

    pairs.sort((a, b) => a.from - b.from);
    return pairs;
  }

  private computePairIndex(view: EditorView): number | undefined {
    const doc = view.state.doc.toString();
    const pairs = this.computePairs(doc, this.currentEnvName);
    if (!pairs.length) return undefined;

    if (typeof this.token.start === 'number') {
      for (let i = 0; i < pairs.length; i++) {
        const p = pairs[i];
        if (this.token.start >= p.from && this.token.start <= p.to) return i;
      }
    }

    if (this.token.latex) {
      const pos = doc.indexOf(this.token.latex);
      if (pos !== -1) {
        for (let i = 0; i < pairs.length; i++) {
          const p = pairs[i];
          if (pos >= p.from && pos <= p.to) return i;
        }
      }
    }

    return undefined;
  }

  private findEnvironmentByPairs(doc: string): { from: number; to: number } | null {
    const pairs = this.computePairs(doc, this.currentEnvName);
    if (!pairs.length) return null;

    const idx = (this.token as any)._pairIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < pairs.length) {
      const p = pairs[idx];
      return { from: p.from, to: p.to };
    }

    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    const wanted = normalize(this.currentContent);
    for (const p of pairs) {
      const candidate = doc.slice(p.contentStart, p.to - (`\\end{${this.currentEnvName}}`).length);
      if (normalize(candidate) === wanted) return { from: p.from, to: p.to };
    }

    if (typeof this.token.start === 'number') {
      let best = pairs[0];
      let bestDist = Math.abs(best.from - this.token.start);
      for (let i = 1; i < pairs.length; i++) {
        const d = Math.abs(pairs[i].from - this.token.start);
        if (d < bestDist) {
          best = pairs[i];
          bestDist = d;
        }
      }
      return { from: best.from, to: best.to };
    }

    return { from: pairs[0].from, to: pairs[0].to };
  }

  private updateVisualElements(header: HTMLElement, wrapper: HTMLElement, newName: string, newContent: string, view: EditorView) {
    header.textContent = newName.charAt(0).toUpperCase() + newName.slice(1);
    wrapper.className = `latex-visual-environment latex-env-${newName}`;
    this.applyEnvironmentStyles(wrapper, header);
    if (this.contentDiv) {
      this.contentDiv.innerHTML = '';
      NestedContentRenderer.renderNestedContent(this.contentDiv, newContent, view, this.showCommands);
    }
  }

  private updateEnvironmentContent(view: EditorView, newContent: string) {
    if (this.isEditing) return;
    
    if (newContent !== this.currentContent) {
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }
      
      this.updateTimeout = setTimeout(() => {
        // Store the old content temporarily
        const oldContent = this.currentContent;
        
        this.currentContent = newContent;
        
        const normalizedOld = oldContent.replace(/\s+/g, ' ').trim();
        const normalizedNew = newContent.replace(/\s+/g, ' ').trim();
        
        if (normalizedOld !== normalizedNew) {
          this.updateEnvironment(view, this.currentEnvName, newContent);
        }
        
        this.updateTimeout = null;
      }, 150);
    }
  }

  private updateTimeout: number | null = null;

  private finishEditing(editContainer: HTMLElement, header: HTMLElement) {
    this.isEditing = false;
    if (editContainer.parentNode) {
      (editContainer.parentNode as HTMLElement).removeChild(editContainer);
    }
    header.style.display = 'block';
    if (this.contentDiv) {
      this.contentDiv.style.display = 'block';
    }
  }

  private applyEnvironmentStyles(wrapper: HTMLElement, header: HTMLElement) {
    const envName = this.currentEnvName;
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
