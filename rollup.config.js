import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: 'src/index.ts',
    output: {
      format: 'es',
      file: 'dist/index.js',
      sourcemap: true
    },
    external: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      'prosemirror-inputrules',
      'prosemirror-state',
      'prosemirror-view',
      'prosemirror-model',
      'prosemirror-keymap',
      'prosemirror-commands'
    ],
    plugins: [typescript()]
  },
  {
    input: 'src/index.ts',
    output: {
      format: 'es',
      file: 'dist/index.d.ts'
    },
    plugins: [dts()]
  }
];