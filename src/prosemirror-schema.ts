import { Schema } from 'prosemirror-model';
import { createEditableMath } from './math-field-utils';

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
        latex: { default: '' }
      },
      parseDOM: [{ tag: 'math-field' }],
      toDOM: node => {
        const container = document.createElement('div');
        container.className = 'math-inline-container';

        const mathfield = createEditableMath(node.attrs.latex, false);
        mathfield.setAttribute('data-original-latex', node.attrs.latex);
        (mathfield as any).readOnly = true;

        const indicator = document.createElement('div');
        indicator.className = 'math-edit-indicator';
        indicator.innerHTML = '✏️';

        container.addEventListener('mouseenter', () => {
          indicator.classList.add('visible');
        });

        container.addEventListener('mouseleave', () => {
          indicator.classList.remove('visible');
        });

        container.appendChild(mathfield);
        container.appendChild(indicator);

        return container;
      }
    },

    math_display: {
      group: 'block',
      atom: true,
      attrs: {
        latex: { default: '' }
      },
      parseDOM: [{ tag: 'math-field.math-display-field' }],
      toDOM: node => {
        const container = document.createElement('div');
        container.className = 'math-display-container';

        const mathfield = createEditableMath(node.attrs.latex, true);
        mathfield.setAttribute('data-original-latex', node.attrs.latex);
        (mathfield as any).readOnly = true;

        const indicator = document.createElement('div');
        indicator.className = 'math-edit-indicator math-edit-indicator-display';
        indicator.innerHTML = '✏️';

        container.addEventListener('mouseenter', () => {
          indicator.classList.add('visible');
        });

        container.addEventListener('mouseleave', () => {
          indicator.classList.remove('visible');
        });

        container.appendChild(mathfield);
        container.appendChild(indicator);

        return container;
      }
    },

    section: {
      group: 'block',
      content: 'inline*',
      attrs: {
        level: { default: 1 },
        latex: { default: '' },
        name: { default: '' },
        showCommands: { default: false }
      },
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } }
      ],
      toDOM: node => {
        const showCommands = node.attrs.showCommands;

        if (showCommands) {
          return [
            'div',
            {
              class: `latex-section-command latex-section-level-${node.attrs.level}`,
              'data-latex': node.attrs.latex,
              'data-level': node.attrs.level
            },
            ['span', { class: 'cmd-prefix' }, `\\${node.attrs.name || `${'sub'.repeat(node.attrs.level - 1)}section`}{`],
            ['span', { class: 'cmd-content' }, 0],
            ['span', { class: 'cmd-suffix' }, '}']
          ];
        }

        return [
          `h${node.attrs.level}`,
          {
            'data-latex': node.attrs.latex,
            class: 'latex-section'
          },
          0
        ];
      }
    },

    environment: {
      group: 'block',
      content: 'block*',
      attrs: {
        name: { default: '' },
        latex: { default: '' },
        params: { default: '' },
        showCommands: { default: false }
      },
      parseDOM: [{ tag: 'div.latex-env' }],
      toDOM: node => {
        const showCommands = node.attrs.showCommands;

        if (showCommands) {
          return [
            'div',
            {
              class: 'latex-env-command',
              'data-latex': node.attrs.latex,
              'data-env': node.attrs.name
            },
            ['div', { class: 'env-begin' }, `\\begin{${node.attrs.name}}`],
            ['div', { class: 'env-content' }, 0],
            ['div', { class: 'env-end' }, `\\end{${node.attrs.name}}`]
          ];
        }

        return [
          'div',
          {
            class: `latex-env latex-env-${node.attrs.name}`,
            'data-latex': node.attrs.latex,
            'data-env': node.attrs.name
          },
          ['div', { class: 'env-header' }, `${node.attrs.name}`],
          ['div', { class: 'env-content' }, 0]
        ];
      }
    },

    editable_command: {
      group: 'inline',
      inline: true,
      content: 'inline*',
      attrs: {
        name: { default: '' },
        latex: { default: '' },
        showCommands: { default: false }
      },
      parseDOM: [{ tag: 'span.latex-editable-command' }],
      toDOM: node => {
        const cmdName = node.attrs.name;
        const showCommands = node.attrs.showCommands;

        if (showCommands) {
          return [
            'span',
            {
              class: `latex-editable-command-raw latex-cmd-${cmdName}`,
              'data-latex': node.attrs.latex,
              'data-cmd': cmdName
            },
            node.attrs.latex
          ];
        }

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