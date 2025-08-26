import { Schema } from 'prosemirror-model';

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

    math_inline: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        latex: { default: '' },
        rendered: { default: '' }
      },
      parseDOM: [{ tag: 'span.math-inline' }],
      toDOM: node => [
        'span',
        {
          class: 'math-inline',
          'data-latex': node.attrs.latex
        },
        node.attrs.rendered || node.attrs.latex
      ]
    },

    math_display: {
      group: 'block',
      atom: true,
      attrs: {
        latex: { default: '' },
        rendered: { default: '' }
      },
      parseDOM: [{ tag: 'div.math-display' }],
      toDOM: node => [
        'div',
        {
          class: 'math-display',
          'data-latex': node.attrs.latex
        },
        node.attrs.rendered || node.attrs.latex
      ]
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
        0
      ]
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