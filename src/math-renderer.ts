import katex from 'katex';

export function renderMath(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      trust: false,
      strict: 'warn'
    });
  } catch (error) {
    console.warn('KaTeX rendering error:', error);
    return `<span class="math-error">${latex}</span>`;
  }
}

export function isMathValid(latex: string): boolean {
  try {
    katex.renderToString(latex, { throwOnError: true });
    return true;
  } catch {
    return false;
  }
}