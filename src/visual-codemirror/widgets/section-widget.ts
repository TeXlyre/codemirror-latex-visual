import { EditorView } from '@codemirror/view';
import { BaseLatexWidget } from './base-widget';

export class SectionWidget extends BaseLatexWidget {
  toDOM(view: EditorView): HTMLElement {
    const level = this.token.level || 1;
    const content = this.token.content || '';
    const sectionName = this.token.name || `${'sub'.repeat(level - 1)}section`;

    if (this.showCommands) {
      const wrapper = document.createElement('div');
      wrapper.className = `latex-visual-section-command latex-visual-section-${level}`;

      const prefix = document.createElement('span');
      prefix.className = 'latex-cmd-prefix';
      prefix.textContent = `\\${sectionName}{`;
      prefix.style.color = '#007acc';
      prefix.style.fontWeight = '600';
      prefix.style.fontFamily = 'monospace';

      const contentSpan = document.createElement('span');
      contentSpan.className = 'latex-cmd-content';
      contentSpan.textContent = content;
      contentSpan.style.fontWeight = 'bold';

      const suffix = document.createElement('span');
      suffix.className = 'latex-cmd-suffix';
      suffix.textContent = '}';
      suffix.style.color = '#007acc';
      suffix.style.fontWeight = '600';
      suffix.style.fontFamily = 'monospace';

      wrapper.appendChild(prefix);
      wrapper.appendChild(contentSpan);
      wrapper.appendChild(suffix);

      wrapper.style.background = 'rgba(0, 123, 255, 0.1)';
      wrapper.style.borderLeft = '4px solid #007acc';
      wrapper.style.padding = '8px 12px';
      wrapper.style.margin = '20px 0 10px 0';
      wrapper.style.borderRadius = '4px';

      return wrapper;
    }

    const heading = document.createElement(`h${level}`);
    heading.className = `latex-visual-section latex-visual-section-${level}`;
    heading.textContent = content;
    heading.style.margin = '1em 0 0.5em 0';
    heading.style.borderBottom = '1px solid #ddd';
    heading.style.paddingBottom = '0.2em';

    return heading;
  }
}