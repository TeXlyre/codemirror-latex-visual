import { Schema } from 'prosemirror-model';
import { renderMath } from './math-renderer';

export const latexVisualSchema = new Schema({
  nodes: {
    doc: {
      content: 'block+'
    },

    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0]
    },

    text: {
      group: 'inline'
    },

    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br']
    },

    comment: {
      group: 'block',
      content: 'text*',
      attrs: {
        latex: { default: '' }
      },
      parseDOM: [{ tag: 'div.latex-comment' }],
      toDOM: node => [
        'div',
        {
          class: 'latex-comment',
          'data-latex': node.attrs.latex
        },
        0
      ]
    },

    math_inline: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        latex: { default: '' },
        rendered: { default: '' }
      },
      parseDOM: [{ tag: 'span.math-inline' }],
      toDOM: node => {
        const span = document.createElement('span');
        span.className = 'math-inline';
        span.setAttribute('data-latex', node.attrs.latex);

        try {
          const rendered = renderMath(node.attrs.latex, false);
          span.innerHTML = rendered;
        } catch (error) {
          span.textContent = `$${node.attrs.latex}$`;
          span.classList.add('math-error');
        }

        return span;
      }
    },

    math_display: {
      group: 'block',
      atom: true,
      attrs: {
        latex: { default: '' },
        rendered: { default: '' }
      },
      parseDOM: [{ tag: 'div.math-display' }],
      toDOM: node => {
        const div = document.createElement('div');
        div.className = 'math-display';
        div.setAttribute('data-latex', node.attrs.latex);

        try {
          const rendered = renderMath(node.attrs.latex, true);
          div.innerHTML = rendered;
        } catch (error) {
          div.textContent = `$$${node.attrs.latex}$$`;
          div.classList.add('math-error');
        }

        return div;
      }
    },

    section: {
      group: 'block',
      content: 'inline*',
      attrs: {
        level: { default: 1 },
        latex: { default: '' }
      },
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } }
      ],
      toDOM: node => [
        `h${node.attrs.level}`,
        { 'data-latex': node.attrs.latex },
        0
      ]
    },

    environment: {
      group: 'block',
      content: 'block*',
      attrs: {
        name: { default: '' },
        latex: { default: '' },
        params: { default: '' }
      },
      parseDOM: [{ tag: 'div.latex-env' }],
      toDOM: node => [
        'div',
        {
          class: `latex-env latex-env-${node.attrs.name}`,
          'data-latex': node.attrs.latex,
          'data-env': node.attrs.name
        },
        ['div', { class: 'env-header' }, `${node.attrs.name}`],
        ['div', { class: 'env-content' }, 0]
      ]
    },

    editable_command: {
      group: 'inline',
      inline: true,
      content: 'inline*',
      attrs: {
        name: { default: '' },
        latex: { default: '' }
      },
      parseDOM: [{ tag: 'span.latex-editable-command' }],
      toDOM: node => {
        const cmdName = node.attrs.name;
        return [
          'span',
          {
            class: `latex-editable-command latex-cmd-${cmdName}`,
            'data-latex': node.attrs.latex,
            'data-cmd': cmdName
          },
          ['span', { class: 'cmd-label' }, `\\${cmdName}{`],
          ['span', { class: 'cmd-content' }, 0],
          ['span', { class: 'cmd-label' }, '}']
        ];
      }
    },

    command: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        name: { default: '' },
        latex: { default: '' },
        params: { default: '' }
      },
      parseDOM: [{ tag: 'span.latex-command' }],
      toDOM: node => [
        'span',
        {
          class: `latex-command latex-cmd-${node.attrs.name}`,
          'data-latex': node.attrs.latex
        },
        node.attrs.latex
      ]
    }
  },

  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        { style: 'font-weight=bold' },
        { style: 'font-weight=700' }
      ],
      toDOM: () => ['strong', 0]
    },
    em: {
      parseDOM: [
        { tag: 'em' },
        { tag: 'i' },
        { style: 'font-style=italic' }
      ],
      toDOM: () => ['em', 0]
    }
  }
});