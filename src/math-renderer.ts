import { MathfieldElement } from 'mathlive';
MathfieldElement.soundsDirectory = null;

export function createEditableMath(latex: string, displayMode: boolean = false): HTMLElement {
  const mathfield = new MathfieldElement();

  mathfield.value = latex;
  mathfield.readOnly = false;
  mathfield.mathVirtualKeyboardPolicy = 'manual';
  mathfield.smartMode = true;
  mathfield.smartFence = true;
  mathfield.smartSuperscript = true;

  if (displayMode) {
    mathfield.classList.add('math-display-field');
    mathfield.setAttribute('style', 'display: block; text-align: center; min-height: 2em; width: 100%;');
  } else {
    mathfield.classList.add('math-inline-field');
    mathfield.setAttribute('style', 'display: inline-block; min-width: 2em;');
  }

  mathfield.addEventListener('focusin', () => {
    if ((window as any).mathVirtualKeyboard) {
      (window as any).mathVirtualKeyboard.show();
    }
  });

  mathfield.addEventListener('focusout', () => {
    if ((window as any).mathVirtualKeyboard) {
      (window as any).mathVirtualKeyboard.hide();
    }
  });

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