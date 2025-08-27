import { MathfieldElement } from 'mathlive';

export function createEditableMath(latex: string, displayMode: boolean = false): HTMLElement {
  // Set the plonk sound to null globally to disable it
  if ((window as any).MathfieldElement) {
    (window as any).MathfieldElement.plonkSound = null;
  }

  const mathfield = new MathfieldElement();
  mathfield.value = latex;

  // Configure for full editing capability
  mathfield.readOnly = false;
  mathfield.mathVirtualKeyboardPolicy = 'auto';
  mathfield.smartMode = true;

  if (displayMode) {
    mathfield.classList.add('math-display-field');
    mathfield.setAttribute('style', 'display: block; text-align: center; min-height: 2em;');
  } else {
    mathfield.classList.add('math-inline-field');
    mathfield.setAttribute('style', 'display: inline-block; min-width: 2em;');
  }

  return mathfield;
}

export function renderStaticMath(latex: string, displayMode: boolean = false): string {
  try {
    const mathfield = new MathfieldElement();
    mathfield.value = latex;
    mathfield.readOnly = true;
    return mathfield.outerHTML;
  } catch (error) {
    console.warn('MathLive rendering error:', error);
    return `<span class="math-error">${latex}</span>`;
  }
}

export function isMathValid(latex: string): boolean {
  try {
    const mathfield = new MathfieldElement();
    mathfield.value = latex;
    return true;
  } catch {
    return false;
  }
}