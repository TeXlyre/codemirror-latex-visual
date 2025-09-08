import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';

export class ListWidget extends BaseLatexWidget {
  private listElement?: HTMLElement;
  private isEditing: boolean = false;
  private currentEnvName: string;
  private currentContent: string;
  private isOrderedList: boolean;

  constructor(token: any, showCommands: boolean = false) {
    super(token, showCommands);
    this.currentEnvName = token.name || '';
    this.currentContent = token.content || '';
    this.isOrderedList = this.currentEnvName === 'enumerate';
  }

  toDOM(view: EditorView): HTMLElement {
    if (this.showCommands) {
      return this.createCommandView(view);
    }

    const wrapper = document.createElement('div');
    wrapper.className = `latex-visual-list latex-list-${this.currentEnvName}`;
    wrapper.style.margin = '0';
    wrapper.style.lineHeight = '1.4';

    this.preserveLineHeight(wrapper, this.token.latex);

    this.listElement = this.createListElement(view);
    wrapper.appendChild(this.listElement);

    return wrapper;
  }

  private createListElement(view: EditorView): HTMLElement {
    const listTag = this.getListTag();
    const list = document.createElement(listTag);
    list.className = 'latex-visual-list-element';
    list.style.margin = '10px 0';
    list.style.paddingLeft = '40px';

    const items = this.parseListItems();

    items.forEach((itemContent, index) => {
      const li = this.createListItem(itemContent, index, view);
      list.appendChild(li);
    });

    if (items.length === 0) {
      const li = this.createListItem('', 0, view);
      list.appendChild(li);
    }

    return list;
  }

  private getListTag(): string {
    switch (this.currentEnvName) {
      case 'enumerate':
        return 'ol';
      case 'itemize':
        return 'ul';
      case 'description':
        return 'dl';
      default:
        return 'ul';
    }
  }

  private parseListItems(): string[] {
    if (!this.currentContent.trim()) {
      return [];
    }

    const items: string[] = [];
    const content = this.currentContent.trim();

    const itemMatches = content.split(/\\item\s*/);

    for (let i = 1; i < itemMatches.length; i++) {
      let itemContent = itemMatches[i].trim();

      if (this.currentEnvName === 'description') {
        const bracketMatch = itemContent.match(/^\[([^\]]*)\]\s*(.*)/s);
        if (bracketMatch) {
          itemContent = `[${bracketMatch[1]}] ${bracketMatch[2]}`;
        }
      }

      items.push(itemContent);
    }

    return items;
  }

  private createListItem(content: string, index: number, view: EditorView): HTMLElement {
    if (this.currentEnvName === 'description') {
      return this.createDescriptionItem(content, index, view);
    }

    const li = document.createElement('li');
    li.className = 'latex-list-item';
    li.contentEditable = 'true';
    li.style.outline = 'none';
    li.style.margin = '5px 0';
    li.style.cursor = 'text';
    li.dataset.itemIndex = index.toString();

    if (this.currentEnvName === 'description' && content.startsWith('[')) {
      const match = content.match(/^\[([^\]]*)\]\s*(.*)/s);
      if (match) {
        const term = document.createElement('strong');
        term.textContent = match[1];
        const desc = document.createTextNode(` ${match[2]}`);
        li.appendChild(term);
        li.appendChild(desc);
      } else {
        li.textContent = content;
      }
    } else {
      li.textContent = content;
    }

    this.setupListItemEvents(li, view);

    return li;
  }

  private createDescriptionItem(content: string, index: number, view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'latex-description-item';
    wrapper.style.margin = '5px 0';
    wrapper.dataset.itemIndex = index.toString();

    let term = '';
    let description = content;

    const match = content.match(/^\[([^\]]*)\]\s*(.*)/s);
    if (match) {
      term = match[1];
      description = match[2];
    }

    const dt = document.createElement('dt');
    dt.contentEditable = 'true';
    dt.style.fontWeight = 'bold';
    dt.style.outline = 'none';
    dt.style.cursor = 'text';
    dt.textContent = term;
    dt.dataset.itemPart = 'term';

    const dd = document.createElement('dd');
    dd.contentEditable = 'true';
    dd.style.marginLeft = '20px';
    dd.style.outline = 'none';
    dd.style.cursor = 'text';
    dd.textContent = description;
    dd.dataset.itemPart = 'description';

    wrapper.appendChild(dt);
    wrapper.appendChild(dd);

    this.setupDescriptionItemEvents(dt, dd, view);

    return wrapper;
  }

  private setupListItemEvents(li: HTMLElement, view: EditorView) {
    li.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.createNewListItem(li, view);
      } else if (e.key === 'Backspace' && li.textContent === '' && this.getItemCount() > 1) {
        e.preventDefault();
        this.removeListItem(li, view);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.handleTabNavigation(li, !e.shiftKey);
      }
    });

    li.addEventListener('input', (e) => {
      e.stopPropagation();
      this.deferredUpdateListContent(view);
    });

    li.addEventListener('mousedown', (e) => e.stopPropagation());
    li.addEventListener('click', (e) => e.stopPropagation());
    li.addEventListener('focus', (e) => e.stopPropagation());
    li.addEventListener('blur', () => this.deferredUpdateListContent(view));
  }

  private setupDescriptionItemEvents(dt: HTMLElement, dd: HTMLElement, view: EditorView) {
    [dt, dd].forEach(element => {
      element.addEventListener('keydown', (e) => {
        e.stopPropagation();

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (element === dd) {
            this.createNewDescriptionItem(element.parentElement as HTMLElement, view);
          } else {
            dd.focus();
          }
        } else if (e.key === 'Backspace' && element.textContent === '' && this.getItemCount() > 1) {
          e.preventDefault();
          this.removeDescriptionItem(element.parentElement as HTMLElement, view);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (element === dt) {
            dd.focus();
          } else {
            this.handleDescriptionTabNavigation(element.parentElement as HTMLElement, !e.shiftKey);
          }
        }
      });

      element.addEventListener('input', (e) => {
        e.stopPropagation();
        this.deferredUpdateListContent(view);
      });

      element.addEventListener('mousedown', (e) => e.stopPropagation());
      element.addEventListener('click', (e) => e.stopPropagation());
      element.addEventListener('focus', (e) => e.stopPropagation());
      element.addEventListener('blur', () => this.deferredUpdateListContent(view));
    });
  }

  private deferredUpdateListContent(view: EditorView) {
    setTimeout(() => {
      this.updateListContent(view);
    }, 0);
  }

  private createNewListItem(currentItem: HTMLElement, view: EditorView) {
    const currentText = (currentItem.textContent || '').trim();

    if (!currentText) {
      this.exitList(currentItem, view);
      return;
    }

    const newItem = this.createListItem('', 0, view);

    if (currentItem.nextSibling) {
      currentItem.parentNode?.insertBefore(newItem, currentItem.nextSibling);
    } else {
      currentItem.parentNode?.appendChild(newItem);
    }

    this.updateItemIndices();
    this.deferredUpdateListContent(view);

    setTimeout(() => {
      const editableElement = newItem.contentEditable === 'true' ? newItem : newItem.querySelector('[contenteditable="true"]');
      (editableElement as HTMLElement)?.focus();
    }, 10);
  }

  private createNewDescriptionItem(currentWrapper: HTMLElement, view: EditorView) {
    const dt = currentWrapper.querySelector('dt');
    const dd = currentWrapper.querySelector('dd');
    const termText = (dt?.textContent || '').trim();
    const descText = (dd?.textContent || '').trim();

    if (!termText && !descText) {
      this.exitList(currentWrapper, view);
      return;
    }

    const newWrapper = this.createDescriptionItem('', 0, view);

    if (currentWrapper.nextSibling) {
      currentWrapper.parentNode?.insertBefore(newWrapper, currentWrapper.nextSibling);
    } else {
      currentWrapper.parentNode?.appendChild(newWrapper);
    }

    this.updateItemIndices();
    this.deferredUpdateListContent(view);

    setTimeout(() => {
      const dt = newWrapper.querySelector('dt') as HTMLElement;
      dt?.focus();
    }, 10);
  }

  private removeListItem(item: HTMLElement, view: EditorView) {
    const prevItem = item.previousElementSibling as HTMLElement;
    const nextItem = item.nextElementSibling as HTMLElement;

    item.remove();
    this.updateItemIndices();
    this.deferredUpdateListContent(view);

    setTimeout(() => {
      const focusItem = prevItem || nextItem;
      if (focusItem) {
        const editableElement = focusItem.contentEditable === 'true' ? focusItem : focusItem.querySelector('[contenteditable="true"]');
        (editableElement as HTMLElement)?.focus();
      }
    }, 10);
  }

  private removeDescriptionItem(wrapper: HTMLElement, view: EditorView) {
    const prevWrapper = wrapper.previousElementSibling as HTMLElement;
    const nextWrapper = wrapper.nextElementSibling as HTMLElement;

    wrapper.remove();
    this.updateItemIndices();
    this.deferredUpdateListContent(view);

    setTimeout(() => {
      const focusWrapper = prevWrapper || nextWrapper;
      if (focusWrapper) {
        const dd = focusWrapper.querySelector('dd') as HTMLElement;
        dd?.focus();
      }
    }, 10);
  }

  private exitList(currentItem: HTMLElement, view: EditorView) {
    currentItem.remove();

    this.deferredUpdateListContent(view);

    setTimeout(() => {
      const pos = this.findTokenInDocument(view);
      if (pos) {
        const newPos = pos.to;
        view.dispatch({
          changes: { from: newPos, to: newPos, insert: '\n\n' },
          selection: { anchor: newPos + 2 }
        });
        view.focus();
      }
    }, 10);
  }

  private handleTabNavigation(currentItem: HTMLElement, forward: boolean) {
    const items = Array.from(currentItem.parentNode?.children || []) as HTMLElement[];
    const currentIndex = items.indexOf(currentItem);

    const targetIndex = forward ? currentIndex + 1 : currentIndex - 1;
    const targetItem = items[targetIndex];

    if (targetItem) {
      const editableElement = targetItem.contentEditable === 'true' ? targetItem : targetItem.querySelector('[contenteditable="true"]');
      (editableElement as HTMLElement)?.focus();
    }
  }

  private handleDescriptionTabNavigation(currentWrapper: HTMLElement, forward: boolean) {
    const wrappers = Array.from(currentWrapper.parentNode?.children || []) as HTMLElement[];
    const currentIndex = wrappers.indexOf(currentWrapper);

    const targetIndex = forward ? currentIndex + 1 : currentIndex - 1;
    const targetWrapper = wrappers[targetIndex];

    if (targetWrapper) {
      const dt = targetWrapper.querySelector('dt') as HTMLElement;
      dt?.focus();
    }
  }

  private updateItemIndices() {
    if (!this.listElement) return;

    const items = Array.from(this.listElement.children);
    items.forEach((item, index) => {
      (item as HTMLElement).dataset.itemIndex = index.toString();
    });
  }

  private getItemCount(): number {
    return this.listElement?.children.length || 0;
  }

  private updateListContent(view: EditorView) {
    if (!this.listElement) return;

    const items: string[] = [];

    if (this.currentEnvName === 'description') {
      const wrappers = Array.from(this.listElement.children) as HTMLElement[];
      wrappers.forEach(wrapper => {
        const dt = wrapper.querySelector('dt');
        const dd = wrapper.querySelector('dd');
        const term = dt?.textContent?.trim() || '';
        const desc = dd?.textContent?.trim() || '';

        if (term || desc) {
          items.push(`[${term}] ${desc}`);
        }
      });
    } else {
      const listItems = Array.from(this.listElement.children) as HTMLElement[];
      listItems.forEach(li => {
        const content = li.textContent?.trim() || '';
        if (content) {
          items.push(content);
        }
      });
    }

    const itemsLatex = items.map(item => `\\item ${item}`).join('\n');
    const newContent = itemsLatex;
    const newLatex = `\\begin{${this.currentEnvName}}\n${newContent}\n\\end{${this.currentEnvName}}`;

    this.currentContent = newContent;
    this.updateTokenInEditor(view, newLatex);
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
    wrapper.style.lineHeight = '1.0';

    this.preserveLineHeight(wrapper, this.token.latex);

    const beginDiv = document.createElement('div');
    beginDiv.className = 'env-begin';
    beginDiv.textContent = `\\begin{${this.currentEnvName}}`;
    beginDiv.style.color = '#28a745';
    beginDiv.style.fontWeight = '600';
    beginDiv.style.margin = '0 0 5px 0';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'env-content';
    contentDiv.contentEditable = 'true';
    contentDiv.style.margin = '5px 0';
    contentDiv.style.paddingLeft = '20px';
    contentDiv.style.borderLeft = '2px solid rgba(40, 167, 69, 0.3)';
    contentDiv.style.outline = 'none';
    contentDiv.style.minHeight = '20px';
    contentDiv.textContent = this.currentContent;

    contentDiv.addEventListener('input', (e) => {
      e.stopPropagation();
      const newContent = contentDiv.textContent || '';
      this.updateEnvironmentContent(view, newContent);
    });

    contentDiv.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        contentDiv.blur();
      }
    });

    contentDiv.addEventListener('mousedown', (e) => e.stopPropagation());
    contentDiv.addEventListener('click', (e) => e.stopPropagation());
    contentDiv.addEventListener('focus', (e) => e.stopPropagation());
    contentDiv.addEventListener('blur', () => {
      const newContent = contentDiv.textContent || '';
      this.updateEnvironmentContent(view, newContent);
    });

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

  private updateEnvironmentContent(view: EditorView, newContent: string) {
    if (newContent !== this.currentContent) {
      const newLatex = `\\begin{${this.currentEnvName}}\n${newContent.trim()}\n\\end{${this.currentEnvName}}`;
      this.currentContent = newContent.trim();
      this.updateTokenInEditor(view, newLatex);
    }
  }
}