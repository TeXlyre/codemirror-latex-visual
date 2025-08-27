import { Schema } from 'prosemirror-model';
import { createEditableMath } from './math-renderer';

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
        container.style.cssText = 'display: inline-block; position: relative;';

        const mathfield = createEditableMath(node.attrs.latex, false);
        mathfield.setAttribute('data-original-latex', node.attrs.latex);
        (mathfield as any).readOnly = true;

        const editBtn = document.createElement('button');
        editBtn.className = 'math-edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.style.cssText = `
          position: absolute;
          top: -8px;
          right: -8px;
          width: 16px;
          height: 16px;
          border: none;
          border-radius: 50%;
          background: #007acc;
          color: white;
          font-size: 10px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 100;
        `;

        container.addEventListener('mouseenter', () => {
          editBtn.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
          editBtn.style.opacity = '0';
        });

        container.appendChild(mathfield);
        container.appendChild(editBtn);

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
        container.style.cssText = 'display: block; position: relative; margin: 10px 0;';

        const mathfield = createEditableMath(node.attrs.latex, true);
        mathfield.setAttribute('data-original-latex', node.attrs.latex);
        (mathfield as any).readOnly = true;

        const editBtn = document.createElement('button');
        editBtn.className = 'math-edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          border: none;
          border-radius: 50%;
          background: #007acc;
          color: white;
          font-size: 12px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 100;
        `;

        container.addEventListener('mouseenter', () => {
          editBtn.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
          editBtn.style.opacity = '0';
        });

        container.appendChild(mathfield);
        container.appendChild(editBtn);

        return container;
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