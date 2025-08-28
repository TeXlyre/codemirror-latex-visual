const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  devServer: {
    static: './dist',
    hot: true,
    port: 3000
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ],
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../../node_modules'),
      path.resolve(__dirname, '../..')
    ],
    alias: {
      '@codemirror/state': path.resolve(__dirname, '../../node_modules/@codemirror/state'),
      '@codemirror/view': path.resolve(__dirname, '../../node_modules/@codemirror/view'),
      '@codemirror/language': path.resolve(__dirname, '../../node_modules/@codemirror/language'),
      'prosemirror-state': path.resolve(__dirname, '../../node_modules/prosemirror-state'),
      'prosemirror-view': path.resolve(__dirname, '../../node_modules/prosemirror-view'),
      'prosemirror-model': path.resolve(__dirname, '../../node_modules/prosemirror-model'),
      'prosemirror-inputrules': path.resolve(__dirname, '../../node_modules/prosemirror-inputrules'),
    }
  }
};